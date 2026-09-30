"use client";

import { useClientValue } from "@/hooks/useClientValue";

/**
 * True when the address has `?replay=1`: the console shows its replay bar, and does
 * not poll the engine's health, so a recording is not disturbed by background requests.
 * Read from `location` rather than useSearchParams, which a static export would
 * otherwise need a Suspense boundary for.
 */
export function useReplayMode(): boolean {
  return useClientValue(() => new URLSearchParams(window.location.search).get("replay") === "1", false);
}
