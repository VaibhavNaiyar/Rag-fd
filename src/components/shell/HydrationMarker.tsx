"use client";

import { useEffect } from "react";

/**
 * Sets `data-hydrated="true"` on <html> once React has taken over the page. The tests
 * wait for it before they press anything, so a click never lands on markup that has no
 * handlers yet. It is the same for every view and every shell, and draws nothing.
 */
export function HydrationMarker(): null {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
