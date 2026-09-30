"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
/** What is actually showing: a preference of "system" resolves to the OS setting. */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "slr.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/*
 * The preference lives in a tiny module-level store rather than component state:
 * localStorage is external, and `useSyncExternalStore` lets a static export
 * hydrate against the light default and then correct itself without an effect.
 *
 * Light is the default: the Samsung palette on a cool slate canvas. Dark is a
 * choice the reader makes, never something the operating system imposes. The
 * inline script in layout.tsx applies the stored choice before first paint;
 * this store keeps it in step afterwards, across tabs as well.
 */
let current: ThemePreference = "light";
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

function readStored(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
  } catch {
    // Private mode, or storage blocked. The light palette is the default.
    return "light";
  }
}

function apply(theme: ThemePreference): void {
  const root = document.documentElement;
  // "system" removes the attribute entirely, leaving the prefers-color-scheme
  // block in tokens.css in charge — so there is one dark palette, not two.
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    current = readStored();
    apply(current);

    const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
    const onSystemChange = () => notify();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      current = readStored();
      apply(current);
      notify();
    };
    media?.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    detach = () => {
      media?.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detach?.();
      detach = null;
    }
  };
}

function commit(theme: ThemePreference): void {
  current = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }
  apply(theme);
  notify();
}

function resolve(theme: ThemePreference): ResolvedTheme {
  if (theme !== "system") return theme;
  const prefersDark = typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
  return prefersDark ? "dark" : "light";
}

const ORDER: ThemePreference[] = ["light", "dark", "system"];

export function useTheme(): {
  theme: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
} {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => "light" as ThemePreference,
  );
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(current),
    () => "light" as ResolvedTheme,
  );

  const cycleTheme = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    if (next) commit(next);
  }, []);

  return { theme, resolved, setTheme: commit, cycleTheme };
}
