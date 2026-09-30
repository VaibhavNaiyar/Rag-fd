import { describe, expect, it } from "vitest";
import { binValues, layoutSeries, percentOf } from "./chartUtils";

describe("binValues", () => {
  it("splits the range into equal bins and counts each value once", () => {
    const bins = binValues([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(bins).toHaveLength(3);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(10);
    expect(bins[0]?.start).toBe(1);
    expect(bins[2]?.end).toBe(10);
  });

  it("puts the largest value in the last bin, not past the end", () => {
    const bins = binValues([0, 10], 4);
    expect(bins.map((bin) => bin.count)).toEqual([1, 0, 0, 1]);
  });

  it("gives one bin to a single value or to identical values", () => {
    expect(binValues([7], 8)).toEqual([{ start: 7, end: 7, count: 1 }]);
    expect(binValues([3, 3, 3], 8)).toEqual([{ start: 3, end: 3, count: 3 }]);
  });

  it("ignores values that are not numbers", () => {
    const bins = binValues([1, Number.NaN, 2, Number.POSITIVE_INFINITY, 3], 2);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });

  it("returns nothing for no data or no bins", () => {
    expect(binValues([], 8)).toEqual([]);
    expect(binValues([Number.NaN], 8)).toEqual([]);
    expect(binValues([1, 2], 0)).toEqual([]);
  });

  it("covers the whole range with contiguous bins, for random data", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 300; round += 1) {
      const values = Array.from({ length: 1 + Math.floor(random() * 200) }, () => random() * 2000 - 500);
      const count = 1 + Math.floor(random() * 12);
      const bins = binValues(values, count);
      const low = Math.min(...values);
      const high = Math.max(...values);
      expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
      expect(bins[0]?.start).toBeCloseTo(low, 9);
      expect(bins[bins.length - 1]?.end).toBeCloseTo(high, 9);
      bins.slice(1).forEach((bin, at) => expect(bin.start).toBeCloseTo(bins[at]?.end ?? Number.NaN, 9));
    }
  });
});

describe("layoutSeries", () => {
  it("puts the smallest value at the bottom and the largest at the top, inside the padding", () => {
    const { runs } = layoutSeries([10, 20, 30], 100, 32, 2);
    expect(runs).toEqual(["2,30 50,16 98,2"]);
  });

  it("runs a constant series along the middle", () => {
    expect(layoutSeries([5, 5, 5], 100, 32, 2).runs).toEqual(["2,16 50,16 98,16"]);
  });

  it("breaks the line at a gap instead of dropping to zero", () => {
    const { runs, lone } = layoutSeries([1, 2, null, 4, 5], 100, 32, 2);
    expect(runs).toHaveLength(2);
    expect(lone).toEqual([]);
  });

  it("keeps a value that stands alone between gaps, as a point to draw a tick at", () => {
    const { runs, lone } = layoutSeries([1, null, 3, null, 5], 100, 32, 2);
    expect(runs).toEqual([]);
    expect(lone).toHaveLength(3);
  });

  it("centres a single value", () => {
    const { lone } = layoutSeries([42], 100, 32, 2);
    expect(lone).toEqual([{ x: 50, y: 16 }]);
  });

  it("has nothing to draw for no data, or for data that is all gaps", () => {
    expect(layoutSeries([], 100, 32)).toEqual({ runs: [], lone: [], min: 0, max: 0 });
    expect(layoutSeries([null, Number.NaN], 100, 32).runs).toEqual([]);
  });

  it("reports the extremes of what it drew", () => {
    const { min, max } = layoutSeries([4, null, 9, 1], 100, 32);
    expect([min, max]).toEqual([1, 9]);
  });

  it("keeps every point inside the box, for random series", () => {
    let seed = 99;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 300; round += 1) {
      const values = Array.from({ length: 1 + Math.floor(random() * 40) }, () => (random() < 0.15 ? null : random() * 1000 - 200));
      const height = 16 + Math.floor(random() * 80);
      const { runs, lone } = layoutSeries(values, 100, height, 2);
      const points = [...runs.flatMap((run) => run.split(" ").map((pair) => pair.split(",").map(Number))), ...lone.map((point) => [point.x, point.y])];
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(2 - 1e-6);
        expect(x).toBeLessThanOrEqual(98 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(2 - 1e-6);
        expect(y).toBeLessThanOrEqual(height - 2 + 1e-6);
      }
    }
  });
});

describe("percentOf", () => {
  it("scales to 0 to 100 and clamps", () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(300, 200)).toBe(100);
    expect(percentOf(-5, 200)).toBe(0);
  });

  it("is zero on a scale with no extent, or a value that is not a number", () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(Number.NaN, 10)).toBe(0);
  });
});
