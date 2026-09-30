"use client";

import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Keeps <meta name="theme-color"> equal to the navy chrome of whichever theme is
 * showing, so the browser's own toolbar matches the page on mobile.
 *
 * That meta is read before any stylesheet runs, so it cannot name a CSS variable,
 * and Next's `viewport.themeColor` would need the colour spelled out as a literal,
 * which the token rules forbid. This reads the resolved value of --chrome from the
 * page instead, so tokens.css stays the only place the colour exists.
 */
export function ThemeColorSync(): null {
  const { resolved } = useTheme();

  useEffect(() => {
    const chrome = getComputedStyle(document.documentElement).getPropertyValue("--chrome").trim();
    if (!chrome) return;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = chrome;
  }, [resolved]);

  return null;
}
