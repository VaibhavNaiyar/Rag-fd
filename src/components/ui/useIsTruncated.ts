"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Is the text in this element cut off with an ellipsis? Attach `ref` to the element
 * with `truncate`; re-checks when its size changes and when `dependency` changes.
 * The check runs from a ResizeObserver and an animation frame, never during render.
 */
export function useIsTruncated<T extends HTMLElement>(dependency?: unknown): { ref: RefObject<T | null>; truncated: boolean } {
  const ref = useRef<T | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const check = () => setTruncated(node.scrollWidth > node.clientWidth + 1);
    const frame = window.requestAnimationFrame(check);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    observer?.observe(node);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [dependency]);

  return { ref, truncated };
}
