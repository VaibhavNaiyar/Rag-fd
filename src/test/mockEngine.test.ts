import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AGUIEvent } from "@ag-ui/core";
import { EventSchemas } from "@ag-ui/core/schemas";
import { describe, expect, it } from "vitest";
import { MockSession, framesForScenario, renumber, type TraceRecordLike } from "../../e2e/mock-engine/synthesize.mjs";
import { applyAgUiEvent } from "@/store/reducer";
import type { AppState } from "@/store/types";

/*
 * The mock engine replays real trace records as AG-UI streams. This proves the
 * streams are ones the real frontend pipeline accepts: every frame passes
 * AG-UI's own schema, and the real reducer folds them into complete turns that
 * agree with the record they came from.
 */

interface Scenario {
  fixture: string;
  family: string;
  records: (TraceRecordLike & Record<string, any>)[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const dir = fileURLToPath(new URL("../../e2e/fixtures/traces/", import.meta.url));
const scenarios: Scenario[] = readdirSync(dir)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(readFileSync(`${dir}${name}`, "utf8")) as Scenario);

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

function fold(frames: { frame: { type: string } }[]): AppState {
  return frames.reduce((state, { frame }) => {
    const parsed = EventSchemas.safeParse(frame);
    if (!parsed.success) throw new Error(`not a valid AG-UI event: ${JSON.stringify(frame).slice(0, 200)}`);
    return applyAgUiEvent(state, parsed.data as AGUIEvent);
  }, EMPTY);
}

describe("fixtures", () => {
  it("has the six scenarios, each with its records unchanged in shape", () => {
    expect(scenarios.map((scenario) => scenario.fixture)).toEqual([
      "asqa_late_detail_01",
      "compound_01",
      "late_detail_01",
      "late_detail_02",
      "presentation_03",
      "unanswerable_01",
    ]);
    const required = [
      "trace_version", "session_id", "turn_id", "started_at", "mode", "controller", "utterance", "utterance_end_ms", "chunks",
      "decisions", "retrieval_events", "first_retrieval_ms", "before_utterance_end", "sub_queries", "decomposition", "retrieval",
      "fusion", "answer", "citations", "citation_support_rate", "fabricated_citations", "fabricated_citations_blocked",
      "uncertainty", "latency_ms", "cost", "models", "errors",
    ];
    for (const scenario of scenarios) for (const record of scenario.records) expect(required.filter((field) => !(field in record))).toEqual([]);
  });
});

describe.each(scenarios)("mock engine stream: $fixture", (scenario) => {
  const { frames } = framesForScenario(scenario.records);
  const state = fold(frames);

  it("is accepted by AG-UI's schema and the real reducer, and ends with no run open and no error", () => {
    expect(frames.length).toBeGreaterThan(20);
    expect(state.openRun).toBeNull();
    expect(state.lastError).toBeNull();
    expect(state.connection).toBe("open");
    expect(state.corpus).toEqual({ docs: 12, chunks: 96 });
  });

  it("builds one complete turn per record, in order", () => {
    expect(state.turns.map((turn) => turn.id)).toEqual(scenario.records.map((_, at) => `t${at + 1}`));
    expect(state.turns.every((turn) => turn.status === "complete")).toBe(true);
  });

  it("restores the transcript, the controller decisions and the searches", () => {
    scenario.records.forEach((record, at) => {
      const turn = state.turns[at];
      expect(turn?.transcript).toHaveLength(record.chunks.length);
      expect(turn?.decisions).toHaveLength(record.decisions.length);
      const started = record.retrieval_events.filter((event: { event?: string }) => event.event === undefined);
      expect(turn?.retrievals).toHaveLength(started.length);
      const cancelled = record.retrieval_events.filter((event: { event?: string }) => event.event === "retrieval_cancelled");
      expect(turn?.retrievals.filter((search) => search.cancelledReason !== undefined)).toHaveLength(cancelled.length);
    });
  });

  it("restores the answer text, the claims and the evidence", () => {
    scenario.records.forEach((record, at) => {
      const turn = state.turns[at];
      const version = turn?.versions.find((candidate) => candidate.version === record.answer.version);
      expect(version?.complete).toBe(true);
      expect(version?.body).toBe(String(record.answer.body).replace(/^\s+/, ""));
      expect(version?.claims).toHaveLength(record.answer.claim_count);
      expect(version?.uncertainty).toEqual(record.uncertainty);
      // Evidence is everything any search kept plus the fused set, exactly as the reducer merges it.
      const expected = new Set<string>(record.fusion?.chunk_ids ?? []);
      for (const result of record.retrieval) for (const kept of result.kept) expected.add(kept.chunk_id);
      expect(new Set(turn?.evidence.map((hit) => hit.chunkId))).toEqual(expected);
      for (const chunkId of record.fusion?.chunk_ids ?? []) expect(turn?.evidence.some((hit) => hit.chunkId === chunkId)).toBe(true);
      expect(turn?.latencyMs?.firstToken).toBe(record.latency_ms.first_token_after_end);
      expect(turn?.cost?.turnTokens).toBe(record.cost.turnTokens);
    });
  });

  it("resolves every citation marker in the answer to a hit", () => {
    scenario.records.forEach((record, at) => {
      const turn = state.turns[at];
      const version = turn?.versions.find((candidate) => candidate.version === record.answer.version);
      const markers = String(version?.body ?? "").match(/\[[A-Za-z0-9_.:-]+\s*§[^\]\n]{1,24}\]/g) ?? [];
      const citations = new Set(turn?.evidence.map((hit) => hit.citation));
      expect(markers.filter((marker) => !citations.has(marker))).toEqual([]);
    });
  });
});

describe("renumbering", () => {
  it("plays a scenario twice in one session under fresh turn ids, with every id built on them", () => {
    const scenario = scenarios.find((candidate) => candidate.fixture === "late_detail_01");
    if (!scenario) throw new Error("late_detail_01 is missing");
    const session = new MockSession({ sessionId: "s_test", corpus: { docs: 1, chunks: 1 } });
    const opening = session.opening().map((frame) => ({ frame }));
    const first = session.play(scenario.records, { startedAt: 0 });
    const second = session.play(scenario.records, { startedAt: 1000 });
    const state = fold([...opening, ...first.frames, ...second.frames]);

    expect(state.turns.map((turn) => turn.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(second.records.map((record) => record.turn_id)).toEqual(["t3", "t4"]);
    expect(second.records.every((record) => record.session_id === "s_test")).toBe(true);
    // The refine turn still points at its parent's claims, renumbered with it.
    const refine = second.records[1] as TraceRecordLike & { refinement: { preserved: string[] } };
    expect(refine.refinement.preserved.every((id) => id.startsWith("t3_"))).toBe(true);
    expect(JSON.stringify(second.records)).not.toMatch(/"t1_|"t2_/);
    expect(state.turns.every((turn) => turn.status === "complete")).toBe(true);
  });

  it("does not rewrite twice when ids chain (t1 to t2, t2 to t3)", () => {
    const moved = renumber({ a: "t1_x", b: "t2_y", turn_id: "t2" }, new Map([["t1", "t2"], ["t2", "t3"]]));
    expect(moved).toEqual({ a: "t2_x", b: "t3_y", turn_id: "t3" });
  });
});
