"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Match a media query in React state.
 *
 * `useSyncExternalStore` rather than an effect: the match is external state the
 * browser owns, and this keeps a static export from hydrating against a width it
 * could not have known at build time. The server snapshot is always false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
