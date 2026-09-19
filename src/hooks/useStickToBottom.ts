"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 64;

/**
 * Auto-scroll that yields to the reader.
 *
 * The list follows new tokens only while the viewer is already at the bottom.
 * Scroll up to inspect an earlier turn and the stream stops yanking the view
 * away — which matters during a live session when someone reads a citation mid-answer.
 */
export function useStickToBottom<T extends HTMLElement>(dependency: unknown): {
  ref: React.RefObject<T | null>;
  isPinned: boolean;
  scrollToBottom: () => void;
} {
  const ref = useRef<T | null>(null);
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);

  const scrollToBottom = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    pinnedRef.current = true;
    setIsPinned(true);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      const pinned = distance <= NEAR_BOTTOM_PX;
      pinnedRef.current = pinned;
      setIsPinned(pinned);
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!pinnedRef.current) return;
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [dependency]);

  return { ref, isPinned, scrollToBottom };
}
