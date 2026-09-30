import { describe, expect, it } from "vitest";
import { loadTraceFixtures } from "@/test/fixtures";
import { parseTraceRecord } from "@/types/trace";

describe("parseTraceRecord", () => {
  it("parses every real fixture record", () => {
    const files = loadTraceFixtures();
    expect(files.length).toBe(6);
    const total = files.reduce((sum, f) => sum + f.records.length, 0);
    expect(total).toBe(10);
  });

  it("returns invalid (never throws) on garbage input", () => {
    for (const input of [null, undefined, 42, "hello", {}, [], { trace_version: 1 }]) {
      const result = parseTraceRecord(input);
      expect(result.ok).toBe(false);
    }
  });

  it("flags a future trace_version as unsupported, not invalid", () => {
    const result = parseTraceRecord({ trace_version: 2 });
    expect(result).toEqual({ ok: false, kind: "unsupported", version: 2 });
  });

  it("drops unknown fields instead of failing", () => {
    const files = loadTraceFixtures();
    const base = files[0]?.records[0];
    expect(base).toBeDefined();
    const result = parseTraceRecord({ ...base, some_future_field: "x" });
    expect(result.ok).toBe(true);
    if (result.ok) expect("some_future_field" in result.record).toBe(false);
  });

  it("accepts null for the four nullable-when-present fields (trace.py's `nullable` set)", () => {
    const files = loadTraceFixtures();
    const base = files[0]?.records[0] as unknown as Record<string, unknown>;
    const result = parseTraceRecord({
      ...base,
      first_retrieval_ms: null,
      before_utterance_end: null,
      decomposition: null,
      fusion: null,
    });
    expect(result.ok).toBe(true);
  });

  it("a suppressed turn genuinely has no first retrieval", () => {
    const files = loadTraceFixtures();
    const suppressed = files.flatMap((f) => f.records).find((r) => r.mode === "suppress");
    expect(suppressed).toBeDefined();
    expect(suppressed?.first_retrieval_ms).toBeNull();
  });

  it("rejects a record missing a required field", () => {
    const files = loadTraceFixtures();
    const base = files[0]?.records[0] as Record<string, unknown>;
    const { citations: _citations, ...withoutCitations } = base;
    const result = parseTraceRecord(withoutCitations);
    expect(result.ok).toBe(false);
  });
});
