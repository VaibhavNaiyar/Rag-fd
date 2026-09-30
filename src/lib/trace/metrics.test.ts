import { describe, expect, it } from "vitest";
import { aggregateTraceMetrics, leadMs, percentiles, stepTimeShares } from "@/lib/trace/metrics";
import { loadTraceFixtures } from "@/test/fixtures";

describe("percentiles", () => {
  it("hand-computed: [10,20,30,40,50] -> p50 30 (nearest-rank), mean 30", () => {
    const result = percentiles([10, 20, 30, 40, 50]);
    expect(result).toEqual({ p50: 30, p90: 50, mean: 30, n: 5 });
  });

  it("hand-computed: [100] -> every stat is 100", () => {
    expect(percentiles([100])).toEqual({ p50: 100, p90: 100, mean: 100, n: 1 });
  });

  it("empty or all-null input is all null, n 0", () => {
    expect(percentiles([])).toEqual({ p50: null, p90: null, mean: null, n: 0 });
    expect(percentiles([null, undefined, null])).toEqual({ p50: null, p90: null, mean: null, n: 0 });
  });

  it("ignores null/undefined mixed with real values", () => {
    const result = percentiles([null, 10, undefined, 20, 30]);
    expect(result.n).toBe(3);
    expect(result.mean).toBe(20);
  });

  it("is order-independent", () => {
    expect(percentiles([50, 10, 40, 20, 30])).toEqual(percentiles([10, 20, 30, 40, 50]));
  });
});

describe("leadMs", () => {
  it("matches the real compound_01 fixture (first_retrieval_rel_end: -4517 -> lead +4517)", () => {
    const record = loadTraceFixtures().find((f) => f.fixture === "compound_01")!.records[0]!;
    expect(leadMs(record)).toBe(4517);
  });

  it("is null when the field is null (a suppressed turn, no retrieval)", () => {
    const suppressed = loadTraceFixtures().flatMap((f) => f.records).find((r) => r.mode === "suppress")!;
    expect(leadMs(suppressed)).toBeNull();
  });
});

describe("aggregateTraceMetrics", () => {
  it("hand-computed totals over two synthetic records", () => {
    const base = loadTraceFixtures()[0]!.records[0]!;
    const a = { ...base, cost: { ...base.cost!, turnUsd: 0.01, turnTokens: 100 }, citation_support_rate: 0.8, fabricated_citations: 1 };
    const b = { ...base, cost: { ...base.cost!, turnUsd: 0.02, turnTokens: 200 }, citation_support_rate: 1.0, fabricated_citations: 0 };
    const result = aggregateTraceMetrics([a, b]);
    expect(result.turns).toBe(2);
    expect(result.costUsd.mean).toBeCloseTo(0.015, 10);
    expect(result.tokens.mean).toBe(150);
    expect(result.totalFabricatedCitations).toBe(1);
  });

  it("groups by mode, counting every fixture record", () => {
    const records = loadTraceFixtures().flatMap((f) => f.records);
    const result = aggregateTraceMetrics(records);
    const total = Object.values(result.byMode).reduce((a, b) => a + b, 0);
    expect(total).toBe(records.length);
    expect(result.turns).toBe(10);
  });

  it("an empty set produces all-null percentiles, not NaN or a throw", () => {
    const result = aggregateTraceMetrics([]);
    expect(result.ttft).toEqual({ p50: null, p90: null, mean: null, n: 0 });
    expect(result.turns).toBe(0);
  });
});

describe("stepTimeShares", () => {
  it("shares sum to 100% across the real fixtures", () => {
    const records = loadTraceFixtures().flatMap((f) => f.records);
    const shares = stepTimeShares(records);
    const total = shares.reduce((sum, s) => sum + (s.sharePct ?? 0), 0);
    expect(total).toBeGreaterThan(99.9);
    expect(total).toBeLessThan(100.1);
  });

  it("a step every fixture is missing (plan, when nothing decomposes) reports null, not zero pretending to be data", () => {
    const shares = stepTimeShares([]);
    for (const share of shares) {
      expect(share.medianMs).toBeNull();
      expect(share.sharePct).toBeNull();
    }
  });
});
