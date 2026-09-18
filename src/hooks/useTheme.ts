"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "slr.theme";

/*
 * The preference lives in a tiny module-level store rather than component state:
 * localStorage is external, and `useSyncExternalStore` lets a static export
 * hydrate against "system" and then correct itself without an effect.
 */
let current: ThemePreference = "system";
const listeners = new Set<() => void>();

function readStored(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    // Private mode, or storage blocked. The system palette is a fine default.
    return "system";
  }
}

function apply(theme: ThemePreference): void {
  const root = document.documentElement;
  // "system" removes the attribute entirely, leaving the prefers-color-scheme
  // block in tokens.css in charge — so there is one dark palette, not two.
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    current = readStored();
    apply(current);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(theme: ThemePreference): void {
  current = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }
  apply(theme);
  for (const listener of listeners) listener();
}

const ORDER: ThemePreference[] = ["system", "light", "dark"];

export function useTheme(): {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
} {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => "system" as ThemePreference,
  );

  const cycleTheme = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    if (next) commit(next);
  }, []);

  return { theme, setTheme: commit, cycleTheme };
}
