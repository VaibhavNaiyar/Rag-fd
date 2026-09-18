"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to: the value is read once the client takes over. */
const NEVER_CHANGES = () => () => undefined;

/**
 * Read a browser-only value without an effect.
 *
 * For things that exist only after hydration and then never change — the query
 * string of a static export, for instance. The server snapshot is the fallback,
 * so hydration matches and React swaps in the real value on the client.
 */
export function useClientValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(NEVER_CHANGES, read, () => fallback);
}
