"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Leading + trailing throttle for a fast-changing value (PB-03: streaming
 * answer markdown was re-parsed on every rAF batch — up to 60 times a second
 * for one growing string). The first change in a window applies immediately;
 * further changes inside the window are coalesced into one trailing update at
 * the window's end, so the final value is never dropped, only delayed.
 */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [output, setOutput] = useState(value);
  const lastEmit = useRef(0);
  const pending = useRef<number | null>(null);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
    const now = Date.now();
    const elapsed = now - lastEmit.current;
    if (elapsed >= intervalMs) {
      lastEmit.current = now;
      setOutput(value);
    } else if (pending.current === null) {
      pending.current = window.setTimeout(() => {
        pending.current = null;
        lastEmit.current = Date.now();
        setOutput(latest.current);
      }, intervalMs - elapsed);
    }
  }, [value, intervalMs]);

  useEffect(
    () => () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
    },
    [],
  );

  return output;
}
