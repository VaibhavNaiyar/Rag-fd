import { describe, expect, it } from "vitest";
import { MOCK_SCENARIOS } from "@/lib/transport/mock/scenarios";
import { buildTurnScript } from "@/lib/transport/mock/script";
import { applyServerEvent } from "@/store/reducer";
import { groupEvidence, isSuppressed, latestVersion, retrievalLeadMs } from "@/store/selectors";
import type { AppState, Turn } from "@/store/types";

/**
 * End-to-end over the pure pipeline: compile a fixture into an event script,
 * replay it through the reducer in delivery order, and assert the trace state a
 * judge would be reading. This is what would otherwise need a browser.
 */

const EMPTY: AppState = {
  sessions: [],
  activeSessionId: null,
  turns: [],
  phase: "idle",
  isListening: false,
  draftTranscript: "",
  traceOpen: true,
  sidebarOpen: true,
  hoveredChunkId: null,
  corpus: null,
  connection: "open",
  transportKind: "mock",
  lastError: null,
};

function replay(fixture: string): Turn {
  const spec = MOCK_SCENARIOS[fixture];
  if (!spec) throw new Error(`no fixture ${fixture}`);

  const steps = [...buildTurnScript(fixture, spec)].sort((a, b) => a.atMs - b.atMs);
  const state = steps.reduce((acc, step) => applyServerEvent(acc, step.event), EMPTY);

  const turn = state.turns[0];
  if (!turn) throw new Error("fixture produced no turn");
  return turn;
}

describe("compound_01 — early retrieval and decomposition", () => {
  const turn = replay("compound_01");

  it("starts retrieving before the utterance ends (G2)", () => {
    const lead = retrievalLeadMs(turn);
    expect(lead).not.toBeNull();
    expect(lead ?? 0).toBeGreaterThan(0);
  });

  it("splits one sentence into three sub-queries (G3)", () => {
    expect(turn.subQueries).toHaveLength(3);
    expect(turn.subQueries[0]?.source).toBe("provisional");
    expect(turn.subQueries[1]?.source).toBe("decomposed");
  });

  it("applies the per-sub-query quota once there is more than one intent", () => {
    expect(turn.quotaApplied).toBe(true);
  });

  it("attributes every retrieved chunk to a sub-query", () => {
    const groups = groupEvidence(turn);
    expect(groups.every((group) => group.subQueryId !== "__unassigned")).toBe(true);
    expect(groups).toHaveLength(3);
  });

  it("reports a candidate count for each branch", () => {
    for (const sub of turn.subQueries) {
      expect(sub.candidates ?? 0).toBeGreaterThan(0);
      expect(sub.keptCount ?? 0).toBeGreaterThan(0);
    }
  });

  it("cites only chunks it actually retrieved (G4)", () => {
    const version = latestVersion(turn);
    const citations = new Set(turn.evidence.map((hit) => hit.citation));
    const markers = version?.body.match(/\[[^\]\n]+§[^\]\n]+\]/g) ?? [];
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) expect(citations.has(marker)).toBe(true);
    expect(version?.fabricatedCitations).toBe(0);
  });

  it("completes with a full telemetry record (G6)", () => {
    expect(turn.status).toBe("complete");
    expect(turn.latencyMs?.firstRetrieval ?? 0).toBeLessThan(0); // before the end
    expect(turn.latencyMs?.firstToken ?? 0).toBeGreaterThan(0);
    expect(turn.cost?.turnUsd ?? 0).toBeGreaterThan(0);
    expect(turn.cost?.steps.length ?? 0).toBeGreaterThan(0);
  });
});

describe("late_detail_01 — refine, do not restart", () => {
  const turn = replay("late_detail_01");

  it("produces a second version parented on the first (G5)", () => {
    expect(turn.versions).toHaveLength(2);
    expect(turn.versions[1]?.parent).toBe(1);
    expect(turn.activeVersion).toBe(2);
  });

  it("carries claims through and marks only what changed", () => {
    const v2 = turn.versions[1];
    expect(v2?.preserved).toHaveLength(2);
    expect(v2?.mutated).toHaveLength(1);
  });

  it("does not re-run a full-corpus search", () => {
    expect(turn.fullCorpusSearch).toBe(false);
    expect(latestVersion(turn)?.fullCorpusSearch).toBe(false);
  });

  it("records a refine decision", () => {
    expect(turn.decisions.some((decision) => decision.decision === "refine")).toBe(true);
  });
});

describe("presentation_01 — suppression", () => {
  const turn = replay("presentation_01");

  it("never retrieves", () => {
    expect(turn.retrievals).toHaveLength(0);
    expect(turn.evidence).toHaveLength(0);
    expect(isSuppressed(turn)).toBe(true);
  });

  it("reports no retrieval latency rather than a fake zero", () => {
    expect(turn.latencyMs?.firstRetrieval).toBeNull();
  });

  it("still answers", () => {
    expect(latestVersion(turn)?.body.length ?? 0).toBeGreaterThan(0);
  });
});

describe("unanswerable_01 — uncertainty instead of fabrication", () => {
  const turn = replay("unanswerable_01");

  it("flags what the corpus cannot support", () => {
    expect(latestVersion(turn)?.uncertainty.length ?? 0).toBeGreaterThan(0);
  });

  it("fabricates no citations", () => {
    expect(latestVersion(turn)?.fabricatedCitations).toBe(0);
  });
});
