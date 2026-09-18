import { describe, expect, it } from "vitest";
import { applyServerEvent } from "@/store/reducer";
import { isSuppressed, latestVersion, retrievalLeadMs, selectVersion } from "@/store/selectors";
import type { AppState } from "@/store/types";
import type { Hit, ServerEvent } from "@/types/events";

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
  connection: "connecting",
  transportKind: "mock",
  lastError: null,
};

function play(events: ServerEvent[], from: AppState = EMPTY): AppState {
  return events.reduce(applyServerEvent, from);
}

function hit(chunkId: string, subQueryIds: string[], score = 0.9): Hit {
  return {
    chunkId,
    docId: "Doc_1",
    section: "1.1",
    text: "text",
    score,
    branches: ["dense"],
    subQueryIds,
    citation: `[Doc_1 §1.1]`,
  };
}

describe("applyServerEvent", () => {
  it("moves out of the idle phase on the first turn", () => {
    const state = play([{ type: "turn.start", turnId: "t1" }]);
    expect(state.phase).toBe("active");
    expect(state.turns).toHaveLength(1);
  });

  it("ignores a duplicate turn.start", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "turn.start", turnId: "t1" },
    ]);
    expect(state.turns).toHaveLength(1);
  });

  it("creates a turn when an event arrives before its turn.start", () => {
    const state = play([
      { type: "retrieval.started", turnId: "t9", subQueryId: "s1", trigger: "provisional", atMs: 400 },
    ]);
    expect(state.turns[0]?.id).toBe("t9");
    expect(state.turns[0]?.firstRetrievalMs).toBe(400);
  });

  it("keeps the earliest retrieval as the lead anchor", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "retrieval.started", turnId: "t1", subQueryId: "s2", trigger: "multi_intent", atMs: 1500 },
      { type: "retrieval.started", turnId: "t1", subQueryId: "s1", trigger: "provisional", atMs: 800 },
      { type: "utterance.end", turnId: "t1", atMs: 2100 },
    ]);
    const turn = state.turns[0];
    expect(turn?.firstRetrievalMs).toBe(800);
    expect(turn && retrievalLeadMs(turn)).toBe(1300);
  });

  it("reports no lead until the utterance closes", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "retrieval.started", turnId: "t1", subQueryId: "s1", trigger: "provisional", atMs: 800 },
    ]);
    const turn = state.turns[0];
    expect(turn && retrievalLeadMs(turn)).toBeNull();
  });

  it("marks a retrieval cancelled without dropping its marker", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "retrieval.started", turnId: "t1", subQueryId: "s1", trigger: "provisional", atMs: 500 },
      { type: "retrieval.cancelled", turnId: "t1", subQueryId: "s1", reason: "duplicate_query" },
    ]);
    expect(state.turns[0]?.retrievals).toHaveLength(1);
    expect(state.turns[0]?.retrievals[0]?.cancelledReason).toBe("duplicate_query");
  });

  it("unions sub-query attribution when a chunk satisfies two intents", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "retrieval.result", turnId: "t1", subQueryId: "s1", candidates: 10, kept: [hit("c1", ["s1"])] },
      { type: "retrieval.result", turnId: "t1", subQueryId: "s2", candidates: 10, kept: [hit("c1", ["s2"])] },
    ]);
    expect(state.turns[0]?.evidence).toHaveLength(1);
    expect(state.turns[0]?.evidence[0]?.subQueryIds.sort()).toEqual(["s1", "s2"]);
  });

  it("accumulates streamed tokens into the right version", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "answer.token", turnId: "t1", version: 1, text: "Hello" },
      { type: "answer.token", turnId: "t1", version: 1, text: " world" },
    ]);
    const turn = state.turns[0];
    expect(turn && selectVersion(turn, 1)?.body).toBe("Hello world");
    expect(turn?.status).toBe("answering");
  });

  it("keeps v1 intact and makes v2 active on a refinement", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "answer.token", turnId: "t1", version: 1, text: "first" },
      {
        type: "answer.version",
        turnId: "t1",
        version: 1,
        parent: null,
        claims: [],
        preserved: [],
        mutated: [],
        uncertainty: [],
        citationSupportRate: 1,
        fabricatedCitations: 0,
      },
      { type: "fusion.final", turnId: "t1", hits: [], quotaApplied: true, fullCorpusSearch: false },
      { type: "answer.token", turnId: "t1", version: 2, text: "second" },
      {
        type: "answer.version",
        turnId: "t1",
        version: 2,
        parent: 1,
        claims: [],
        preserved: ["a"],
        mutated: ["b"],
        uncertainty: [],
        citationSupportRate: 0.9,
        fabricatedCitations: 0,
      },
    ]);

    const turn = state.turns[0];
    expect(turn?.versions).toHaveLength(2);
    expect(turn?.activeVersion).toBe(2);
    expect(turn && selectVersion(turn, 1)?.body).toBe("first");
    // The G5 proof has to survive the reducer, not just the wire.
    expect(turn && latestVersion(turn)?.fullCorpusSearch).toBe(false);
  });

  it("recognises a suppressed turn as one that never retrieved", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      {
        type: "controller.decision",
        turnId: "t1",
        decision: "suppress",
        reason: "presentation_only",
        atMs: 600,
      },
      { type: "utterance.end", turnId: "t1", atMs: 900 },
    ]);
    const turn = state.turns[0];
    expect(turn && isSuppressed(turn)).toBe(true);
    expect(turn && retrievalLeadMs(turn)).toBeNull();
  });

  it("attaches a turn-scoped error to that turn", () => {
    const state = play([
      { type: "turn.start", turnId: "t1" },
      { type: "error", turnId: "t1", code: "retriever_timeout", message: "index unavailable" },
    ]);
    expect(state.turns[0]?.status).toBe("error");
    expect(state.lastError?.code).toBe("retriever_timeout");
  });

  it("records a session-level error without inventing a turn", () => {
    const state = play([{ type: "error", code: "socket", message: "dropped" }]);
    expect(state.turns).toHaveLength(0);
    expect(state.lastError?.message).toBe("dropped");
  });

  it("titles the session from the first transcript chunk", () => {
    const state = play([
      { type: "session.ready", sessionId: "s1", corpus: { docs: 3, chunks: 40 } },
      { type: "turn.start", turnId: "t1" },
      { type: "transcript.chunk", turnId: "t1", text: "how does fusion work", atMs: 100 },
    ]);
    expect(state.sessions[0]?.title).toBe("how does fusion work");
    expect(state.corpus?.chunks).toBe(40);
  });
});
