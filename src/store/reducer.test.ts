import { EventType, type AGUIEvent } from "@ag-ui/core";
import { EventSchemas } from "@ag-ui/core/schemas";
import { describe, expect, it } from "vitest";
import { applyAgUiEvent } from "@/store/reducer";
import { isSuppressed, latestVersion, retrievalLeadMs, selectVersion } from "@/store/selectors";
import type { AppState } from "@/store/types";
import type { Hit, SharedTurn, VersionRecord } from "@/types/events";

const EMPTY: AppState = {
  sessions: [],
  activeSessionId: null,
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

/** Every event goes through AG-UI's own schema first, the way the socket receives it. */
function play(events: AGUIEvent[], from: AppState = EMPTY): AppState {
  return events.reduce((state, event) => {
    const parsed = EventSchemas.safeParse(event);
    if (!parsed.success) throw new Error(`not a valid AG-UI event: ${JSON.stringify(event)}`);
    return applyAgUiEvent(state, parsed.data as AGUIEvent);
  }, from);
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

const BLANK_TURN: SharedTurn = {
  transcript: [],
  utteranceEndMs: null,
  decisions: [],
  subQueries: [],
  fusion: null,
  versions: {},
  latencyMs: null,
  cost: null,
};

const VERSION: VersionRecord = {
  parent: null,
  claims: [],
  preserved: [],
  mutated: [],
  uncertainty: [],
  citationSupportRate: 1,
  fabricatedCitations: 0,
};

/* — the engine's event shapes, as its translator emits them — */

const opening = (sessionId = "s1"): AGUIEvent[] => [
  { type: EventType.RUN_STARTED, threadId: sessionId, runId: `${sessionId}:open` },
  {
    type: EventType.STATE_SNAPSHOT,
    snapshot: { session: { id: sessionId, corpus: { docs: 3, chunks: 40 } }, turns: {} },
  },
  { type: EventType.RUN_FINISHED, threadId: sessionId, runId: `${sessionId}:open` },
];

const turnStart = (turnId: string): AGUIEvent[] => [
  { type: EventType.RUN_STARTED, threadId: "s1", runId: turnId },
  { type: EventType.STATE_DELTA, delta: [{ op: "add", path: `/turns/${turnId}`, value: BLANK_TURN }] },
  { type: EventType.STEP_STARTED, stepName: "listen" },
];

const patch = (turnId: string, op: "add" | "replace", field: string, value: unknown): AGUIEvent => ({
  type: EventType.STATE_DELTA,
  delta: [{ op, path: `/turns/${turnId}/${field}`, value }],
});

const search = (id: string, args: Record<string, unknown>): AGUIEvent[] => [
  { type: EventType.TOOL_CALL_START, toolCallId: id, toolCallName: "corpus_search" },
  { type: EventType.TOOL_CALL_ARGS, toolCallId: id, delta: JSON.stringify(args) },
  { type: EventType.TOOL_CALL_END, toolCallId: id },
];

const result = (id: string, content: Record<string, unknown>): AGUIEvent => ({
  type: EventType.TOOL_CALL_RESULT,
  messageId: `${id}:result`,
  toolCallId: id,
  role: "tool",
  content: JSON.stringify(content),
});

const text = (messageId: string, delta: string): AGUIEvent => ({
  type: EventType.TEXT_MESSAGE_CONTENT,
  messageId,
  delta,
});

describe("applyAgUiEvent", () => {
  it("opens the session from its snapshot without inventing a turn", () => {
    const state = play(opening());
    expect(state.turns).toHaveLength(0);
    expect(state.phase).toBe("idle");
    expect(state.corpus?.chunks).toBe(40);
    expect(state.activeSessionId).toBe("s1");
    expect(state.connection).toBe("open");
  });

  it("moves out of the idle phase when a turn's run starts", () => {
    const state = play([...opening(), ...turnStart("t1")]);
    expect(state.phase).toBe("active");
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]?.status).toBe("listening");
  });

  it("keeps the earliest retrieval as the lead anchor", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      ...search("t1_sq1", { query: "catering", trigger: "multi_intent", atMs: 1500 }),
      ...search("t1_p1", { query: "venue", trigger: "provisional", atMs: 800 }),
      patch("t1", "replace", "utteranceEndMs", 2100),
    ]);
    const turn = state.turns[0];
    expect(turn?.firstRetrievalMs).toBe(800);
    expect(turn && retrievalLeadMs(turn)).toBe(1300);
    expect(turn?.status).toBe("retrieving");
  });

  it("reports no lead until the utterance closes", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      ...search("t1_p1", { query: "venue", trigger: "provisional", atMs: 800 }),
    ]);
    const turn = state.turns[0];
    expect(turn && retrievalLeadMs(turn)).toBeNull();
  });

  it("marks a retrieval cancelled without dropping its marker", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      ...search("t1_p1", { query: "venue", trigger: "provisional", atMs: 500 }),
      result("t1_p1", { cancelled: true, reason: "topic_shift" }),
    ]);
    expect(state.turns[0]?.retrievals).toHaveLength(1);
    expect(state.turns[0]?.retrievals[0]?.cancelledReason).toBe("topic_shift");
  });

  it("adds no timeline marker for a reused search", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      ...search("t1_sq1", { query: "venue", reused: true }),
      result("t1_sq1", { candidates: 4, kept: [hit("c1", ["t1_sq1"])], reused: true }),
    ]);
    expect(state.turns[0]?.retrievals).toHaveLength(0);
    expect(state.turns[0]?.evidence).toHaveLength(1);
  });

  it("unions sub-query attribution when a chunk satisfies two intents", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      ...search("s1", { query: "a", trigger: "multi_intent", atMs: 10 }),
      ...search("s2", { query: "b", trigger: "multi_intent", atMs: 10 }),
      result("s1", { candidates: 10, kept: [hit("c1", ["s1"])], reused: false }),
      result("s2", { candidates: 10, kept: [hit("c1", ["s2"])], reused: false }),
    ]);
    expect(state.turns[0]?.evidence).toHaveLength(1);
    expect(state.turns[0]?.evidence[0]?.subQueryIds.sort()).toEqual(["s1", "s2"]);
  });

  it("accumulates streamed text into the right version", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      { type: EventType.TEXT_MESSAGE_START, messageId: "t1:v1", role: "assistant" },
      text("t1:v1", "Hello"),
      text("t1:v1", " world"),
    ]);
    const turn = state.turns[0];
    expect(turn && selectVersion(turn, 1)?.body).toBe("Hello world");
    expect(turn?.status).toBe("answering");
  });

  it("keeps v1 intact and makes v2 active on a refinement", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      { type: EventType.TEXT_MESSAGE_START, messageId: "t1:v1", role: "assistant" },
      text("t1:v1", "first"),
      { type: EventType.TEXT_MESSAGE_END, messageId: "t1:v1" },
      patch("t1", "add", "versions/1", VERSION),
      patch("t1", "replace", "fusion", { hits: [], quotaApplied: true, fullCorpusSearch: false }),
      { type: EventType.TEXT_MESSAGE_START, messageId: "t1:v2", role: "assistant" },
      text("t1:v2", "second"),
      { type: EventType.TEXT_MESSAGE_END, messageId: "t1:v2" },
      patch("t1", "add", "versions/2", { ...VERSION, parent: 1, preserved: ["a"], mutated: ["b"] }),
    ]);

    const turn = state.turns[0];
    expect(turn?.versions).toHaveLength(2);
    expect(turn?.activeVersion).toBe(2);
    expect(turn && selectVersion(turn, 1)?.body).toBe("first");
    expect(turn && selectVersion(turn, 2)?.preserved).toEqual(["a"]);
    // The G5 proof has to survive the reducer, not just the wire.
    expect(turn && latestVersion(turn)?.fullCorpusSearch).toBe(false);
  });

  it("recognises a suppressed turn as one that never retrieved", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      patch("t1", "add", "decisions/-", { decision: "suppress", reason: "presentation_restructure", atMs: 600 }),
      patch("t1", "replace", "utteranceEndMs", 900),
    ]);
    const turn = state.turns[0];
    expect(turn && isSuppressed(turn)).toBe(true);
    expect(turn && retrievalLeadMs(turn)).toBeNull();
  });

  it("completes a turn when its run finishes, and not before", () => {
    const events = [...opening(), ...turnStart("t1"), { type: EventType.STEP_FINISHED, stepName: "listen" }];
    expect(play(events as AGUIEvent[]).turns[0]?.status).toBe("listening");
    const done = play([...(events as AGUIEvent[]), { type: EventType.RUN_FINISHED, threadId: "s1", runId: "t1" }]);
    expect(done.turns[0]?.status).toBe("complete");
    expect(done.openRun).toBeNull();
  });

  it("attaches a run error to the turn whose run failed", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      { type: EventType.RUN_ERROR, message: "index unavailable", code: "turn_failed" },
    ]);
    expect(state.turns[0]?.status).toBe("error");
    expect(state.turns[0]?.errorMessage).toBe("index unavailable");
    expect(state.lastError?.code).toBe("turn_failed");
  });

  it("records an error outside any run without inventing a turn", () => {
    const state = play([...opening(), { type: EventType.RUN_ERROR, message: "frame is not JSON", code: "bad_json" }]);
    expect(state.turns).toHaveLength(0);
    expect(state.lastError?.message).toBe("frame is not JSON");
  });

  it("titles the session from the first transcript chunk", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      patch("t1", "add", "transcript/-", { text: "how does fusion work", atMs: 100 }),
    ]);
    expect(state.sessions[0]?.title).toBe("how does fusion work");
  });

  it("carries the readings to choose between when nothing was verified", () => {
    const state = play([
      ...opening(),
      ...turnStart("t1"),
      patch("t1", "add", "versions/1", { ...VERSION, clarification: ["Fallout 4 setting", "Fallout 76 setting"] }),
    ]);
    const turn = state.turns[0];
    expect(turn && selectVersion(turn, 1)?.clarification).toEqual(["Fallout 4 setting", "Fallout 76 setting"]);
  });

  it("asks nothing when the engine sent no clarification", () => {
    const state = play([...opening(), ...turnStart("t1"), patch("t1", "add", "versions/1", VERSION)]);
    const turn = state.turns[0];
    expect(turn && selectVersion(turn, 1)?.clarification).toEqual([]);
  });

  it("flags a patch that does not apply instead of rendering drifted state", () => {
    const state = play([...opening(), patch("t404", "replace", "utteranceEndMs", 1)]);
    expect(state.lastError?.code).toBe("state_out_of_sync");
  });
});
