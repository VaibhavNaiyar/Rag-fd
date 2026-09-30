"use client";

import { useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function read(key: string, fallback: number): number {
  try {
    const stored = window.localStorage.getItem(key);
    const value = stored === null || stored.trim() === "" ? Number.NaN : Number(stored);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    // Storage blocked (private mode): the default applies.
    return fallback;
  }
}

/** Keeps a number across visits. Storage that is missing or full is not an error: the value just is not kept. */
export function writeStoredNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Not being able to remember it is not a reason to refuse it.
  }
  for (const listener of listeners.get(key) ?? []) listener();
}

/**
 * A number kept in localStorage, as a hook: `[width, setWidth]`. The server, and the
 * first client render, use `fallback`, so hydration matches; the stored value then
 * takes over. Another tab's change arrives through the `storage` event.
 */
export function useStoredNumber(key: string, fallback: number): [number, (value: number) => void] {
  const subscribe = (onChange: () => void) => {
    const set = listeners.get(key) ?? new Set<() => void>();
    set.add(onChange);
    listeners.set(key, set);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      set.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  };

  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  return [value, (next) => writeStoredNumber(key, next)];
}
