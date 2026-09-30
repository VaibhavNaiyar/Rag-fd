"use client";

import { useMemo, useSyncExternalStore } from "react";
import { formatRoute, parseRoute, type Route } from "@/lib/route";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The hash as text. A string, so React can tell whether it changed without parsing it. */
const read = (): string => window.location.hash;

/**
 * Go to a route. A new entry is added to the history, so Back returns to where the
 * reader was; `replace` swaps the current entry instead (a filter being typed).
 * Both change only the hash, which fires `hashchange`, which is what useHashRoute listens to.
 */
export function navigateTo(route: Route, options: { replace?: boolean } = {}): void {
  const address = formatRoute(route);
  if (window.location.hash === address) return;
  if (options.replace) window.location.replace(address);
  else window.location.hash = address;
}

/**
 * The current route, from the address bar. Back and forward work because the address
 * is the state. Before the client takes over (and on the server) it is the console.
 */
export function useHashRoute(): { route: Route; navigate: typeof navigateTo } {
  const hash = useSyncExternalStore(subscribe, read, () => "");
  const route = useMemo(() => parseRoute(hash), [hash]);
  return { route, navigate: navigateTo };
}
