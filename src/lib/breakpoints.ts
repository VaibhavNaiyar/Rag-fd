/**
 * The one place viewport widths are written down (PHASES.md §3.5).
 *
 * Tailwind's `screens` read this file, so `sm:`, `md:`, `lg:`, `xl:` and `2xl:` mean
 * these widths. CSS media queries cannot read a custom property, so layout.css repeats
 * the numbers in a comment beside each query; breakpoints.test.ts fails if they drift.
 * Nothing else in the TypeScript may spell a breakpoint out.
 *
 * Classes, from the smallest phone up:
 *   xs   375 to 479   one view, TabBar, Inspector as a full-height sheet
 *   sm   480 to 767   as xs, with 16 px gutters
 *   md   768 to 1023  NavRail, Inspector as a right sheet
 *   lg   1024 to 1279 Inspector docked
 *   xl   1280 to 1535 Inspector docked, wider
 *   2xl  1536 and up  content capped so line lengths stay readable
 */

export const VIEWPORT_FLOOR = 375;

export const BREAKPOINT_PX = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type BreakpointName = keyof typeof BREAKPOINT_PX;
export type ViewportClass = "xs" | BreakpointName;

/** Smallest to largest, for iteration. */
export const VIEWPORT_CLASSES: readonly ViewportClass[] = ["xs", "sm", "md", "lg", "xl", "2xl"];

/** `(min-width: 768px)` for `md`. */
export const minWidth = (name: BreakpointName): string => `(min-width: ${BREAKPOINT_PX[name]}px)`;

/** `(max-width: 767px)` for `md`: the widths below that breakpoint. */
export const belowWidth = (name: BreakpointName): string => `(max-width: ${BREAKPOINT_PX[name] - 1}px)`;

/** The viewport class a width falls into. Total: any number, including 0 and NaN, gets a class. */
export function viewportClassOf(width: number): ViewportClass {
  if (!(width >= BREAKPOINT_PX.sm)) return "xs";
  if (width < BREAKPOINT_PX.md) return "sm";
  if (width < BREAKPOINT_PX.lg) return "md";
  if (width < BREAKPOINT_PX.xl) return "lg";
  if (width < BREAKPOINT_PX["2xl"]) return "xl";
  return "2xl";
}

/** True from `name` upwards: `isAtLeast("lg", "xl")` is true, `isAtLeast("lg", "md")` is false. */
export function isAtLeast(name: BreakpointName, current: ViewportClass): boolean {
  return VIEWPORT_CLASSES.indexOf(current) >= VIEWPORT_CLASSES.indexOf(name);
}

/** The Inspector docks beside the view from this width; below it, it is a sheet. */
export const INSPECTOR_DOCK_FROM: BreakpointName = "lg";

/** The nav rail replaces the tab bar from this width. */
export const NAV_RAIL_FROM: BreakpointName = "md";

/** Width classes for a container measured in JS (an SVG that must know its width). Same steps, fewer of them. */
export type ContainerClass = "xs" | "sm" | "md" | "lg";

export function containerClassOf(width: number): ContainerClass {
  if (!(width >= BREAKPOINT_PX.sm)) return "xs";
  if (width < BREAKPOINT_PX.md) return "sm";
  if (width < BREAKPOINT_PX.lg) return "md";
  return "lg";
}

/** Tailwind `screens` value: `{ sm: "480px", … }`. */
export function tailwindScreens(): Record<BreakpointName, string> {
  return {
    sm: `${BREAKPOINT_PX.sm}px`,
    md: `${BREAKPOINT_PX.md}px`,
    lg: `${BREAKPOINT_PX.lg}px`,
    xl: `${BREAKPOINT_PX.xl}px`,
    "2xl": `${BREAKPOINT_PX["2xl"]}px`,
  };
}
