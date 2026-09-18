"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Track an element's rendered width.
 *
 * The timeline maps milliseconds to pixels 1:1 rather than scaling a fixed
 * viewBox, so markers stay circular and stroke widths stay honest at any rail
 * width. One ResizeObserver, no layout reads per event.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320): {
  ref: React.RefObject<T | null>;
  width: number;
} {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(1, Math.round(entry.contentRect.width)));
    });

    observer.observe(node);
    setWidth(Math.max(1, Math.round(node.getBoundingClientRect().width)) || fallback);
    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
