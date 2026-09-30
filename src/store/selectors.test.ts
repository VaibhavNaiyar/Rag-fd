import { describe, expect, it } from "vitest";
import { createTurn } from "@/store/reducer";
import { selectMergedTurn, selectSessionMetricsMemo, selectSessionTurns, selectTurnSummary } from "@/store/selectors";
import type { AppState, Turn } from "@/store/types";
import type { TraceEntry } from "@/store/traceSlice";

const BASE: AppState = {
  sessions: [],
  activeSessionId: "s2",
  turns: [],
  phase: "idle",
  isListening: false,
  draftTranscript: "",
  sidebarOpen: true,
  hoveredChunkId: null,
  corpus: null,
  fixtures: [],
  connection: "connecting",
  lastError: null,
  shared: null,
  openRun: null,
  calls: {},
};

describe("selectSessionTurns", () => {
  it("filters to the active session, leaving other sessions' turns out", () => {
    const t1 = createTurn("t1", "s1");
    const t2 = createTurn("t1", "s2");
    const state: AppState = { ...BASE, turns: [t1, t2] };
    expect(selectSessionTurns(state)).toEqual([t2]);
  });

  it("is referentially stable when neither turns nor activeSessionId changed", () => {
    const t1 = createTurn("t1", "s2");
    const state: AppState = { ...BASE, turns: [t1] };
    const first = selectSessionTurns(state);
    const second = selectSessionTurns(state);
    expect(first).toBe(second);
  });

  it("recomputes when the turns array is a new reference", () => {
    const t1 = createTurn("t1", "s2");
    const state1: AppState = { ...BASE, turns: [t1] };
    const state2: AppState = { ...BASE, turns: [...state1.turns] };
    expect(selectSessionTurns(state1)).not.toBe(selectSessionTurns(state2));
  });
});

describe("selectTurnSummary", () => {
  it("is referentially stable for the same turn object", () => {
    const turn = createTurn("t1", "s1");
    expect(selectTurnSummary(turn)).toBe(selectTurnSummary(turn));
  });

  it("differs for a different (even value-equal) turn object", () => {
    const a = createTurn("t1", "s1");
    const b = createTurn("t1", "s1");
    expect(selectTurnSummary(a)).not.toBe(selectTurnSummary(b));
    expect(selectTurnSummary(a)).toEqual(selectTurnSummary(b)); // but equal in value
  });

  it("reads mode, searches and cost off the turn", () => {
    const turn: Turn = {
      ...createTurn("t1", "s1"),
      decisions: [{ decision: "retrieve", reason: "clause_complete", atMs: 10 }],
      retrievals: [{ subQueryId: "sq1", query: "x", trigger: "provisional", atMs: 10 }],
      cost: { turnUsd: 0.01, turnTokens: 50, steps: [], models: [] },
    };
    const summary = selectTurnSummary(turn);
    expect(summary.mode).toBe("retrieve");
    expect(summary.searches).toBe(1);
    expect(summary.costUsd).toBe(0.01);
  });
});

describe("selectSessionMetricsMemo", () => {
  it("is referentially stable for the same turns array", () => {
    const turns = [createTurn("t1", "s1")];
    expect(selectSessionMetricsMemo(turns)).toBe(selectSessionMetricsMemo(turns));
  });

  it("recomputes for a different array, even with the same contents", () => {
    const turns = [createTurn("t1", "s1")];
    expect(selectSessionMetricsMemo(turns)).not.toBe(selectSessionMetricsMemo([...turns]));
  });
});

describe("selectMergedTurn", () => {
  const READY: TraceEntry = { status: "ready", record: null, error: null, fetchedAt: 1 };

  it("finds the live turn by session and turn id, not by id alone (SD-01)", () => {
    const t1s1 = createTurn("t1", "s1");
    const t1s2 = createTurn("t1", "s2");
    const turns = [t1s1, t1s2];
    const traces = {};
    expect(selectMergedTurn(turns, traces, "s2", "t1").live).toBe(t1s2);
    expect(selectMergedTurn(turns, traces, "s1", "t1").live).toBe(t1s1);
  });

  it("live is null when the turn was never seen live in this store", () => {
    const result = selectMergedTurn([], {}, "s1", "t404");
    expect(result.live).toBeNull();
    expect(result.traceStatus).toBe("idle");
  });

  it("pulls the trace status and record from the traces map by the composite key", () => {
    const traces = { "s1:t1": READY };
    const result = selectMergedTurn([], traces, "s1", "t1");
    expect(result.traceStatus).toBe("ready");
  });

  it("is referentially stable when neither turns nor traces changed", () => {
    const turns = [createTurn("t1", "s1")];
    const traces = { "s1:t1": READY };
    expect(selectMergedTurn(turns, traces, "s1", "t1")).toBe(selectMergedTurn(turns, traces, "s1", "t1"));
  });

  it("recomputes when the traces map is a new reference", () => {
    const turns = [createTurn("t1", "s1")];
    const traces1 = { "s1:t1": READY };
    const traces2 = { "s1:t1": READY };
    expect(selectMergedTurn(turns, traces1, "s1", "t1")).not.toBe(selectMergedTurn(turns, traces2, "s1", "t1"));
  });
});
