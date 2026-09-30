"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Route, View } from "@/lib/route";

/*
 * The Inspector is an overlay on a view, and its address (#/inspect/...) does not say
 * which view is behind it. This remembers the last view that was on screen, in a tiny
 * store rather than component state, so it survives the Inspector opening and closing
 * and needs no state set from an effect.
 */
let remembered: View = "console";
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Forgets the remembered view. For tests. */
export function resetActiveView(): void {
  remembered = "console";
  for (const listener of listeners) listener();
}

/** The view to show: the route's own, or, while the Inspector is open, the last one that was shown. */
export function useActiveView(route: Route): View {
  useEffect(() => {
    if (route.kind === "view" && route.view !== remembered) {
      remembered = route.view;
      for (const listener of listeners) listener();
    }
  }, [route]);

  const behind = useSyncExternalStore(
    subscribe,
    () => remembered,
    () => "console" as View,
  );
  return route.kind === "view" ? route.view : behind;
}
