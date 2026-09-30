"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { containerClassOf, type ContainerClass } from "@/lib/breakpoints";

export interface ContainerWidth<T extends HTMLElement> {
  ref: RefObject<T | null>;
  /** The element's content width in whole px. `fallback` until it has been measured. */
  width: number;
  /** `xs`, `sm`, `md` or `lg`, from that width, for the few adaptations CSS cannot make (an SVG). */
  size: ContainerClass;
}

/**
 * Track an element's width.
 *
 * One ResizeObserver, and at most one state update per animation frame: while a pane
 * is being dragged the observer fires many times a frame, and only the last width of
 * the frame is used. The server and the first client render use `fallback`, and the
 * measurement arrives with the observer's first callback, so nothing is read from the
 * layout during render and nothing is set synchronously in the effect.
 */
export function useContainerWidth<T extends HTMLElement>({ fallback = 320 }: { fallback?: number } = {}): ContainerWidth<T> {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    let latest = 0;
    const flush = () => {
      frame = 0;
      setWidth(latest);
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      latest = Math.max(1, Math.round(entry.contentRect.width));
      if (frame === 0) frame = window.requestAnimationFrame(flush);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, width, size: containerClassOf(width) };
}
