import { describe, expect, it } from "vitest";
import { diffFromTrace, diffLiveVersions } from "@/lib/trace/diff";
import type { AnswerVersion } from "@/store/types";
import { loadTraceFixtures } from "@/test/fixtures";

/** Builds a minimal live `AnswerVersion` from a trace record's `answer` field — enough for `diffLiveVersions`, which only reads `claims`, `preserved` and `mutated`. */
function liveVersion(record: ReturnType<typeof loadTraceFixtures>[number]["records"][number]): AnswerVersion {
  const answer = record.answer;
  if (!answer) throw new Error("fixture record has no answer");
  return {
    version: answer.version,
    parent: answer.parent,
    body: answer.body,
    claims: answer.claims,
    preserved: answer.preserved,
    mutated: answer.mutated,
    uncertainty: record.uncertainty,
    citationSupportRate: record.citation_support_rate ?? 0,
    fabricatedCitations: record.fabricated_citations,
    clarification: answer.clarification,
    fullCorpusSearch: answer.full_corpus_search,
    complete: true,
  };
}

describe("diffLiveVersions", () => {
  it("classifies every preserved claim from late_detail_01's real refine", () => {
    const file = loadTraceFixtures().find((f) => f.fixture === "late_detail_01")!;
    const t1 = file.records.find((r) => r.turn_id === "t1")!;
    const t2 = file.records.find((r) => r.turn_id === "t2")!;
    const diff = diffLiveVersions(liveVersion(t1), liveVersion(t2));
    expect(diff.inlineDiffAvailable).toBe(true);
    expect(diff.parentClaimCount).toBe(4);
    expect(diff.rows.filter((r) => r.state === "preserved")).toHaveLength(4);
    for (const row of diff.rows) expect(row.text).not.toBeNull();
  });

  it("a rewritten claim gets a word diff that reconstructs both texts", () => {
    const before: AnswerVersion = {
      version: 1, parent: null, body: "", claims: [{ id: "c1", text: "the trip is to Tokyo", chunkIds: [], subQueryId: "s", support: 1 }],
      preserved: [], mutated: [], uncertainty: [], citationSupportRate: 1, fabricatedCitations: 0, clarification: [], fullCorpusSearch: true, complete: true,
    };
    const after: AnswerVersion = {
      ...before, version: 2, parent: 1,
      claims: [{ id: "c1", text: "the trip is to Seoul", chunkIds: [], subQueryId: "s", support: 1 }],
      mutated: ["c1"],
    };
    const diff = diffLiveVersions(before, after);
    const row = diff.rows.find((r) => r.claimId === "c1")!;
    expect(row.state).toBe("rewritten");
    expect(row.wordDiff).not.toBeNull();
    const reconstructedBefore = row.wordDiff!.filter((t) => t.state !== "added").map((t) => t.text).join(" ");
    const reconstructedAfter = row.wordDiff!.filter((t) => t.state !== "removed").map((t) => t.text).join(" ");
    expect(reconstructedBefore).toBe("the trip is to Tokyo");
    expect(reconstructedAfter).toBe("the trip is to Seoul");
  });

  it("a claim dropped by the child is removed, a claim absent from the parent is added", () => {
    const before: AnswerVersion = {
      version: 1, parent: null, body: "", claims: [
        { id: "c1", text: "kept", chunkIds: [], subQueryId: "s", support: 1 },
        { id: "c2", text: "dropped", chunkIds: [], subQueryId: "s", support: 1 },
      ],
      preserved: [], mutated: [], uncertainty: [], citationSupportRate: 1, fabricatedCitations: 0, clarification: [], fullCorpusSearch: true, complete: true,
    };
    const after: AnswerVersion = {
      ...before, version: 2, parent: 1,
      claims: [
        { id: "c1", text: "kept", chunkIds: [], subQueryId: "s", support: 1 },
        { id: "c3", text: "new claim", chunkIds: [], subQueryId: "s", support: 1 },
      ],
      preserved: ["c1"],
    };
    const diff = diffLiveVersions(before, after);
    expect(diff.rows.find((r) => r.claimId === "c2")).toMatchObject({ state: "removed", text: "dropped" });
    expect(diff.rows.find((r) => r.claimId === "c3")).toMatchObject({ state: "added", text: "new claim" });
    expect(diff.rows.find((r) => r.claimId === "c1")).toMatchObject({ state: "preserved" });
  });
});

describe("diffFromTrace", () => {
  it("late_detail_01's t2 (trace-only) classifies the same preserved set as the live path, with the inline diff marked unavailable", () => {
    const file = loadTraceFixtures().find((f) => f.fixture === "late_detail_01")!;
    const t2 = file.records.find((r) => r.turn_id === "t2")!;
    const diff = diffFromTrace(t2);
    expect(diff.inlineDiffAvailable).toBe(false);
    expect(diff.parentClaimCount).toBe(4);
    expect(diff.rows.filter((r) => r.state === "preserved").map((r) => r.claimId).sort()).toEqual(
      ["t1_v1_c1", "t1_v1_c2", "t1_v1_c3", "t1_v1_c4"].sort(),
    );
    for (const row of diff.rows) expect(row.wordDiff).toBeNull();
  });

  it("a dropped claim has no text — it was never fetched, only its id", () => {
    const record = loadTraceFixtures().find((f) => f.fixture === "late_detail_01")!.records.find((r) => r.turn_id === "t2")!;
    const synthetic = { ...record, refinement: { preserved: [], mutated: [], dropped: ["gone_1"], parent_claims: 1 } };
    const diff = diffFromTrace(synthetic);
    const row = diff.rows.find((r) => r.claimId === "gone_1");
    expect(row).toMatchObject({ state: "removed", text: null, wordDiff: null });
  });

  it("a turn with no refinement field (not a refine) treats every claim as itself, inline diff unavailable", () => {
    const record = loadTraceFixtures().flatMap((f) => f.records).find((r) => r.mode === "retrieve" && !r.refinement)!;
    expect(record).toBeDefined();
    const diff = diffFromTrace(record);
    expect(diff.inlineDiffAvailable).toBe(false);
    expect(diff.rows.every((r) => r.state === "added")).toBe(true);
  });
});
