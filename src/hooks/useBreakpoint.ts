"use client";

import { useSyncExternalStore } from "react";
import { BREAKPOINT_PX, isAtLeast, minWidth, type BreakpointName, type ViewportClass } from "@/lib/breakpoints";

const STEPS = (Object.keys(BREAKPOINT_PX) as BreakpointName[]).map((name) => [name, minWidth(name)] as const);

function subscribe(onChange: () => void): () => void {
  const lists = STEPS.map(([, query]) => window.matchMedia(query));
  for (const list of lists) list.addEventListener("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange);
  };
}

/** The largest step whose media query matches now. A string, so React can compare snapshots by value. */
function snapshot(): ViewportClass {
  let current: ViewportClass = "xs";
  for (const [name, query] of STEPS) if (window.matchMedia(query).matches) current = name;
  return current;
}

/**
 * The viewport class (`xs` to `2xl`), from the same media queries the CSS uses. The
 * server, and the first client render, say `xs`, so a static export hydrates without a
 * mismatch and then corrects itself. Use it for what CSS cannot do (a modal sheet or a
 * docked pane); use CSS for everything else, which has no such frame.
 */
export function useBreakpoint(): ViewportClass {
  return useSyncExternalStore(subscribe, snapshot, () => "xs");
}

/** True from `name` upwards. */
export function useAtLeast(name: BreakpointName): boolean {
  return isAtLeast(name, useBreakpoint());
}
