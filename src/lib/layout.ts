/**
 * The measures of the workbench that TypeScript needs, mirroring tokens.css (a test
 * fails if they drift): the Inspector's width, its limits, and how much of the row the
 * view keeps.
 */
export const INSPECTOR = {
  /** --inspector-min */
  min: 360,
  /** --inspector-max */
  max: 720,
  /** From 1024 px up to 1279 px the Inspector starts narrower, so the view keeps its room. */
  defaultLg: 400,
  /** --inspector-w: from 1280 px up. */
  default: 480,
  /** The view is never squeezed below this. */
  viewMin: 360,
  /** One press of an arrow key on the resizer. */
  step: 16,
  storageKey: "slr.inspector.width",
} as const;

/** Holds an Inspector width between its minimum and the most the row can spare. */
export function clampInspector(width: number, workbenchWidth: number): number {
  const most = Math.max(INSPECTOR.min, Math.min(INSPECTOR.max, workbenchWidth - INSPECTOR.viewMin));
  return Math.min(Math.max(Math.round(width), INSPECTOR.min), most);
}
