"use client";

import type { RefObject } from "react";
import { useContainerWidth } from "@/hooks/useContainerWidth";

/**
 * LEGACY, deleted in P12: the previous name of useContainerWidth, with its previous
 * signature, for the timeline that still uses it. It is useContainerWidth underneath,
 * so it now updates once per frame instead of once per observer callback.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320): {
  ref: RefObject<T | null>;
  width: number;
} {
  const { ref, width } = useContainerWidth<T>({ fallback });
  return { ref, width };
}
