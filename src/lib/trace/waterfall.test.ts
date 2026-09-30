import { describe, expect, it } from "vitest";
import { buildSpanTree } from "@/lib/trace/spans";
import {
  axisTicks,
  barGeometry,
  clampZoom,
  domainOf,
  leadVector,
  stackedRows,
  toPct,
  utteranceEndRule,
  buildWaterfallRows,
  type Domain,
} from "@/lib/trace/waterfall";
import { loadTraceFixtures } from "@/test/fixtures";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("toPct / barGeometry", () => {
  it("clamps into [0, 100] for any ms, including outside the domain", () => {
    const domain: Domain = { startMs: 100, endMs: 1000 };
    expect(toPct(-500, domain)).toBe(0);
    expect(toPct(5000, domain)).toBe(100);
    expect(toPct(100, domain)).toBe(0);
    expect(toPct(1000, domain)).toBe(100);
  });

  it("a zero-span domain never divides by zero", () => {
    const domain: Domain = { startMs: 500, endMs: 500 };
    expect(toPct(500, domain)).toBe(0);
    expect(Number.isNaN(toPct(500, domain))).toBe(false);
  });

  it("a bar's width is never negative even for an inverted window", () => {
    const domain: Domain = { startMs: 0, endMs: 1000 };
    const bar = barGeometry(800, 200, domain);
    expect(bar.widthPct).toBeGreaterThanOrEqual(0);
  });

  it("property: 2,000 random windows over 2,000 random domains never produce NaN, and every width is in [0, 100]", () => {
    const random = seededRandom(20260930);
    for (let i = 0; i < 2000; i += 1) {
      const domain: Domain = { startMs: random() * 1000, endMs: random() * 1000 + random() * 50000 };
      const start = random() * 60000 - 5000;
      const end = start + random() * 20000 - 10000;
      const bar = barGeometry(start, end, domain);
      expect(Number.isNaN(bar.xPct)).toBe(false);
      expect(Number.isNaN(bar.widthPct)).toBe(false);
      expect(bar.xPct).toBeGreaterThanOrEqual(0);
      expect(bar.xPct).toBeLessThanOrEqual(100);
      expect(bar.widthPct).toBeGreaterThanOrEqual(0);
      expect(bar.xPct + bar.widthPct).toBeLessThanOrEqual(100.0001);
    }
  });
});

describe("axisTicks", () => {
  it("lands on nice numbers, ascending, inside the domain", () => {
    const ticks = axisTicks({ startMs: 0, endMs: 10000 });
    expect(ticks.length).toBeGreaterThan(1);
    for (let i = 1; i < ticks.length; i += 1) expect(ticks[i]!.ms).toBeGreaterThan(ticks[i - 1]!.ms);
    for (const tick of ticks) {
      expect(tick.ms).toBeGreaterThanOrEqual(0);
      expect(tick.ms).toBeLessThanOrEqual(10000);
    }
  });

  it("never hangs or produces NaN on a degenerate domain", () => {
    expect(() => axisTicks({ startMs: 0, endMs: 0 })).not.toThrow();
    expect(() => axisTicks({ startMs: 100, endMs: 100 })).not.toThrow();
    expect(() => axisTicks({ startMs: 100, endMs: -100 })).not.toThrow();
    for (const domain of [{ startMs: 0, endMs: 0 }, { startMs: 5, endMs: 5 }]) {
      for (const tick of axisTicks(domain)) expect(Number.isNaN(tick.ms)).toBe(false);
    }
  });

  it("property: 500 random domains always terminate and stay ascending", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 500; i += 1) {
      const domain: Domain = { startMs: random() * 1000, endMs: random() * 1000 + random() * 100000 };
      const ticks = axisTicks(domain, 3 + Math.floor(random() * 8));
      for (let j = 1; j < ticks.length; j += 1) expect(ticks[j]!.ms).toBeGreaterThan(ticks[j - 1]!.ms);
    }
  });
});

describe("utteranceEndRule / leadVector", () => {
  it("is null while the utterance has not ended", () => {
    expect(utteranceEndRule(null, { startMs: 0, endMs: 1000 })).toBeNull();
  });

  it("leadVector direction matches the sign of utteranceEnd - firstRetrieval", () => {
    const domain: Domain = { startMs: 0, endMs: 10000 };
    expect(leadVector(5000, 4000, domain)?.direction).toBe("before"); // retrieval fired before the end: a lead
    expect(leadVector(4000, 5000, domain)?.direction).toBe("after"); // retrieval fired after: no lead
    expect(leadVector(null, 4000, domain)).toBeNull();
    expect(leadVector(4000, null, domain)).toBeNull();
  });

  it("matches the real compound_01 fixture: retrieval fires 4517ms before the utterance ends", () => {
    const record = loadTraceFixtures().find((f) => f.fixture === "compound_01")!.records[0]!;
    const vector = leadVector(record.utterance_end_ms, record.first_retrieval_ms, { startMs: 0, endMs: record.latency_ms!.complete_abs! });
    expect(vector?.leadMs).toBe(4517);
    expect(vector?.direction).toBe("before");
  });
});

describe("clampZoom", () => {
  it("never produces a window wider than the full domain", () => {
    const full: Domain = { startMs: 0, endMs: 1000 };
    const zoom = clampZoom({ startMs: -500, endMs: 5000 }, full);
    expect(zoom.endMs - zoom.startMs).toBeLessThanOrEqual(1000);
    expect(zoom.startMs).toBeGreaterThanOrEqual(0);
    expect(zoom.endMs).toBeLessThanOrEqual(1000);
  });

  it("enforces a minimum span", () => {
    const full: Domain = { startMs: 0, endMs: 100000 };
    const zoom = clampZoom({ startMs: 500, endMs: 501 }, full);
    expect(zoom.endMs - zoom.startMs).toBeGreaterThanOrEqual(50);
  });

  it("property: 1,000 random zooms over random domains always land inside the domain with a non-negative span", () => {
    const random = seededRandom(99);
    for (let i = 0; i < 1000; i += 1) {
      const full: Domain = { startMs: 0, endMs: 100 + random() * 200000 };
      const zoom = { startMs: random() * 300000 - 50000, endMs: random() * 300000 - 50000 };
      const clamped = clampZoom(zoom, full);
      expect(clamped.startMs).toBeGreaterThanOrEqual(full.startMs - 0.001);
      expect(clamped.endMs).toBeLessThanOrEqual(full.endMs + 0.001);
      expect(clamped.endMs).toBeGreaterThanOrEqual(clamped.startMs);
    }
  });
});

describe("buildWaterfallRows / stackedRows", () => {
  it("every real fixture's waterfall rows have widths in [0, 100] and no NaN", () => {
    for (const record of loadTraceFixtures().flatMap((f) => f.records)) {
      const tree = buildSpanTree(record);
      const domain = domainOf(tree);
      for (const row of buildWaterfallRows(tree, domain)) {
        if (!row.geometry) continue;
        expect(Number.isNaN(row.geometry.xPct)).toBe(false);
        expect(Number.isNaN(row.geometry.widthPct)).toBe(false);
        expect(row.geometry.widthPct).toBeGreaterThanOrEqual(0);
        expect(row.geometry.widthPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("stackedRows carries the same widths as the waterfall, just without an offset", () => {
    const record = loadTraceFixtures().find((f) => f.fixture === "compound_01")!.records[0]!;
    const tree = buildSpanTree(record);
    const domain = domainOf(tree);
    const waterfall = buildWaterfallRows(tree, domain);
    const stacked = stackedRows(tree, domain);
    expect(stacked).toHaveLength(waterfall.length);
    stacked.forEach((row, i) => {
      expect(row.widthPct).toBe(waterfall[i]!.geometry?.widthPct ?? null);
    });
  });
});
