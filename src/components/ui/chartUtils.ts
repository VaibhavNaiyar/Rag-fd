/**
 * The arithmetic behind the small charts: binning for the histogram, and turning a
 * series into polyline points for the sparkline. Pure, so it is tested without a browser.
 */

export interface Bin {
  start: number;
  end: number;
  count: number;
}

/** Splits numbers into `bins` equal-width bins from the smallest to the largest. Values that are not finite are ignored. */
export function binValues(values: readonly number[], bins = 8): Bin[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0 || bins < 1) return [];

  const low = finite.reduce((a, b) => Math.min(a, b));
  const high = finite.reduce((a, b) => Math.max(a, b));
  // A single value, or all the same: one bin holds everything.
  if (low === high) return [{ start: low, end: high, count: finite.length }];

  const width = (high - low) / bins;
  const result: Bin[] = Array.from({ length: bins }, (_, index) => ({ start: low + index * width, end: low + (index + 1) * width, count: 0 }));
  for (const value of finite) {
    // The largest value belongs to the last bin, not to a bin past the end.
    const bin = result[Math.min(bins - 1, Math.floor((value - low) / width))];
    if (bin) bin.count += 1;
  }
  return result;
}

export interface Point {
  x: number;
  y: number;
}

export interface Series {
  /** Runs of two or more consecutive values, as SVG `points` strings. */
  runs: string[];
  /** Values that stand alone between gaps: drawn as a tick, since a line needs two points. */
  lone: Point[];
  min: number;
  max: number;
}

/**
 * Lays a series out in a `width` by `height` box, `padding` in from every edge. The
 * smallest value is at the bottom, the largest at the top; a constant series runs
 * along the middle. `null` and non-finite values are gaps: the line breaks there
 * instead of dropping to zero, because a missing measurement is not a zero.
 */
export function layoutSeries(values: readonly (number | null)[], width: number, height: number, padding = 2): Series {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length === 0) return { runs: [], lone: [], min: 0, max: 0 };

  const min = finite.reduce((a, b) => Math.min(a, b));
  const max = finite.reduce((a, b) => Math.max(a, b));
  const span = max - min;
  const count = values.length;
  const usableWidth = width - 2 * padding;
  const usableHeight = height - 2 * padding;

  const at = (index: number, value: number): Point => ({
    x: count === 1 ? width / 2 : padding + (index * usableWidth) / (count - 1),
    y: span === 0 ? height / 2 : height - padding - ((value - min) / span) * usableHeight,
  });

  const runs: string[] = [];
  const lone: Point[] = [];
  let run: Point[] = [];
  const flush = () => {
    if (run.length >= 2) runs.push(run.map((point) => `${round(point.x)},${round(point.y)}`).join(" "));
    else if (run.length === 1 && run[0]) lone.push(run[0]);
    run = [];
  };

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) flush();
    else run.push(at(index, value));
  });
  flush();

  return { runs, lone, min, max };
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** `value / max` as a percentage from 0 to 100. A scale with no extent (max of 0) is empty. */
export function percentOf(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}
