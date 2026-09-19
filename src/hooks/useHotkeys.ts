"use client";

import { useEffect, useRef } from "react";

export interface Hotkey {
  /** Lowercase `event.key`, e.g. "k", "/", "escape", "1". */
  key: string;
  /** Require Cmd on macOS or Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  handler: (event: KeyboardEvent) => void;
  /** Fire even while a text field has focus. Off by default. */
  allowInInput?: boolean;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

/**
 * Global keyboard bindings.
 *
 * Handlers are held in a ref so a re-render never detaches and reattaches the
 * listener — during a live session that would drop a keystroke mid-token-stream.
 */
export function useHotkeys(hotkeys: Hotkey[]): void {
  const ref = useRef(hotkeys);

  // Refreshed after every render rather than during it, so the listener below
  // always sees the current handlers without ever being torn down.
  useEffect(() => {
    ref.current = hotkeys;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;

      for (const hotkey of ref.current) {
        if (hotkey.key !== key) continue;
        if (Boolean(hotkey.mod) !== mod) continue;
        if (Boolean(hotkey.shift) !== event.shiftKey) continue;
        if (!hotkey.allowInInput && isTextEntry(event.target)) continue;
        event.preventDefault();
        hotkey.handler(event);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
