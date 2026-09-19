import { EventType, type AGUIEvent } from "@ag-ui/core";
import { applyPatch, type Operation } from "fast-json-patch";
import { EVIDENCE_SNIPPET_CHARS } from "@/lib/constants";
import { titleFromText, truncate } from "@/lib/format";
import type { AnswerVersion, AppState, Turn, TurnStatus } from "@/store/types";
import {
  parseMessageId,
  type Hit,
  type PipelineStep,
  type SearchArgs,
  type SearchResult,
  type SharedState,
  type SharedTurn,
} from "@/types/events";

/**
 * The AG-UI event reducer.
 *
 * The engine speaks standard AG-UI (see `types/events.ts` for how our payloads
 * sit inside it). This folds that stream into the `Turn` records the UI renders:
 *
 * - STATE_SNAPSHOT / STATE_DELTA  → the shared state, patched with fast-json-patch,
 *   then synced into the turns it touched (transcript, decisions, sub-queries,
 *   fusion, version records, latency, cost)
 * - `corpus_search` tool calls    → the retrieval timeline and the evidence
 * - TEXT_MESSAGE_*                → each answer version's streamed body
 * - STEP_* / RUN_*                → the turn's status
 *
 * AG-UI events this engine never sends are ignored rather than rejected: a
 * standard event we do not use is not an error.
 */

export function createTurn(id: string): Turn {
  return {
    id,
    transcript: [],
    utteranceEndMs: null,
    decisions: [],
    retrievals: [],
    firstRetrievalMs: null,
    subQueries: [],
    evidence: [],
    quotaApplied: false,
    fullCorpusSearch: true,
    versions: [],
    activeVersion: 1,
    latencyMs: null,
    cost: null,
    status: "listening",
    errorMessage: null,
  };
}

const STEP_STATUS: Record<PipelineStep, TurnStatus> = {
  listen: "listening",
  plan: "retrieving",
  retrieve: "retrieving",
  synthesise: "answering",
};

/** Replace one turn, creating it if it has not been seen yet. */
function withTurn(state: AppState, turnId: string, mutate: (turn: Turn) => Turn): AppState {
  const index = state.turns.findIndex((turn) => turn.id === turnId);
  const turns = [...state.turns];

  if (index === -1) {
    turns.push(mutate(createTurn(turnId)));
  } else {
    const existing = turns[index];
    if (!existing) return state;
    turns[index] = mutate(existing);
  }

  return { ...state, turns, phase: "active" };
}

function withVersion(
  turn: Turn,
  version: number,
  mutate: (draft: AnswerVersion) => AnswerVersion,
): Turn {
  const index = turn.versions.findIndex((candidate) => candidate.version === version);
  const versions = [...turn.versions];

  const blank: AnswerVersion = {
    version,
    parent: version > 1 ? version - 1 : null,
    body: "",
    claims: [],
    preserved: [],
    mutated: [],
    uncertainty: [],
    citationSupportRate: 0,
    fabricatedCitations: 0,
    clarification: [],
    fullCorpusSearch: turn.fullCorpusSearch,
    complete: false,
  };

  if (index === -1) versions.push(mutate(blank));
  else versions[index] = mutate(versions[index] ?? blank);

  versions.sort((a, b) => a.version - b.version);
  return { ...turn, versions };
}

/** Trim stored snippets; the full chunk text stays server-side (§15 budget). */
function trimHit(hit: Hit): Hit {
  return { ...hit, text: truncate(hit.text, EVIDENCE_SNIPPET_CHARS) };
}

function mergeEvidence(existing: Hit[], incoming: Hit[]): Hit[] {
  const byId = new Map(existing.map((hit) => [hit.chunkId, hit]));
  for (const hit of incoming) {
    const prior = byId.get(hit.chunkId);
    byId.set(
      hit.chunkId,
      prior
        ? // A chunk can satisfy several sub-queries; union the attribution.
          { ...trimHit(hit), subQueryIds: [...new Set([...prior.subQueryIds, ...hit.subQueryIds])] }
        : trimHit(hit),
    );
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function touchSession(state: AppState, title?: string): AppState {
  if (!state.activeSessionId) return state;
  const sessions = state.sessions.map((session) =>
    session.id === state.activeSessionId
      ? {
          ...session,
          updatedAt: Date.now(),
          turnCount: state.turns.length,
          title: session.title === "New session" && title ? titleFromText(title) : session.title,
        }
      : session,
  );
  return { ...state, sessions };
}

/** Fold one turn of the shared state into its rendered record. */
function syncTurn(turn: Turn, shared: SharedTurn): Turn {
  const fullCorpusSearch = shared.fusion?.fullCorpusSearch ?? turn.fullCorpusSearch;
  let next: Turn = {
    ...turn,
    transcript: shared.transcript,
    utteranceEndMs: shared.utteranceEndMs,
    decisions: shared.decisions,
    subQueries: shared.subQueries.map((item) => {
      const prior = turn.subQueries.find((candidate) => candidate.id === item.id);
      return { ...item, ...(prior ? { candidates: prior.candidates, keptCount: prior.keptCount } : {}) };
    }),
    evidence: shared.fusion ? mergeEvidence(turn.evidence, shared.fusion.hits) : turn.evidence,
    quotaApplied: shared.fusion?.quotaApplied ?? turn.quotaApplied,
    fullCorpusSearch,
    latencyMs: shared.latencyMs,
    cost: shared.cost,
  };
  for (const [key, record] of Object.entries(shared.versions)) {
    const version = Number(key);
    const isNew = !turn.versions.some((v) => v.version === version && v.complete);
    next = withVersion(next, version, (draft) => ({ ...draft, ...record, fullCorpusSearch, complete: true }));
    // The newest version is what the reader should be looking at.
    if (isNew) next = { ...next, activeVersion: version };
  }
  return next;
}

/** Turn ids a JSON Patch touched: the key after `/turns/`, RFC 6901-unescaped. */
function touchedTurns(delta: Operation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of delta) {
    const [root, id] = op.path.split("/").slice(1);
    if (root === "turns" && id !== undefined) ids.add(id.replace(/~1/g, "/").replace(/~0/g, "~"));
  }
  return ids;
}

function syncShared(state: AppState, shared: SharedState, only?: Set<string>): AppState {
  let next: AppState = { ...state, shared, corpus: shared.session?.corpus ?? state.corpus };
  const firstWords: string[] = [];
  for (const [turnId, turn] of Object.entries(shared.turns)) {
    if (only && !only.has(turnId)) continue;
    next = withTurn(next, turnId, (existing) => {
      if (existing.transcript.length === 0 && turn.transcript[0]) firstWords.push(turn.transcript[0].text);
      return syncTurn(existing, turn);
    });
  }
  return firstWords.length > 0 ? touchSession(next, firstWords[0]) : next;
}

function openSession(state: AppState, shared: SharedState): AppState {
  const id = shared.session?.id;
  const opened: AppState = {
    ...state,
    connection: "open",
    lastError: null,
    activeSessionId: state.activeSessionId ?? id ?? null,
    sessions:
      state.sessions.length > 0 || !id
        ? state.sessions
        : [{ id, title: "New session", updatedAt: Date.now(), turnCount: 0 }],
  };
  return syncShared(opened, shared);
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("");
  }
  return "";
}

/** Did the run in flight belong to a turn (rather than a session opening)? */
function runTurn(state: AppState): string | null {
  const run = state.openRun;
  return run && state.turns.some((turn) => turn.id === run) ? run : null;
}

export function applyAgUiEvent(state: AppState, event: AGUIEvent): AppState {
  switch (event.type) {
    case EventType.RUN_STARTED:
      return { ...state, openRun: event.runId };

    case EventType.STATE_SNAPSHOT:
      return openSession(state, event.snapshot as SharedState);

    case EventType.STATE_DELTA: {
      if (!state.shared) return state;
      const delta = event.delta as Operation[];
      try {
        const shared = applyPatch(state.shared, delta, false, false).newDocument;
        return syncShared(state, shared, touchedTurns(delta));
      } catch (error) {
        // A patch that does not apply means our copy drifted; say so rather than render a lie.
        return {
          ...state,
          lastError: { code: "state_out_of_sync", message: `A state update did not apply: ${String(error)}` },
        };
      }
    }

    case EventType.STEP_STARTED: {
      const turnId = runTurn(state);
      const status = STEP_STATUS[event.stepName as PipelineStep];
      if (!turnId || !status) return state;
      return withTurn(state, turnId, (turn) => ({ ...turn, status }));
    }

    case EventType.TOOL_CALL_START: {
      const turnId = runTurn(state);
      if (!turnId) return state;
      return { ...state, calls: { ...state.calls, [event.toolCallId]: { turnId, args: "" } } };
    }

    case EventType.TOOL_CALL_ARGS: {
      const call = state.calls[event.toolCallId];
      if (!call) return state;
      return { ...state, calls: { ...state.calls, [event.toolCallId]: { ...call, args: call.args + event.delta } } };
    }

    case EventType.TOOL_CALL_END: {
      const call = state.calls[event.toolCallId];
      if (!call) return state;
      const args = parseJson<SearchArgs>(call.args);
      // Reused calls answer from a search already on the timeline; they add no marker of their own.
      if (!args || !("trigger" in args)) return state;
      return withTurn(state, call.turnId, (turn) => ({
        ...turn,
        retrievals: [
          ...turn.retrievals,
          { subQueryId: event.toolCallId, query: args.query, trigger: args.trigger, atMs: args.atMs },
        ],
        firstRetrievalMs:
          turn.firstRetrievalMs === null ? args.atMs : Math.min(turn.firstRetrievalMs, args.atMs),
        status: turn.status === "listening" ? "retrieving" : turn.status,
      }));
    }

    case EventType.TOOL_CALL_RESULT: {
      const call = state.calls[event.toolCallId];
      const result = parseJson<SearchResult>(textOf(event.content));
      if (!call || !result) return state;
      if ("cancelled" in result) {
        return withTurn(state, call.turnId, (turn) => ({
          ...turn,
          retrievals: turn.retrievals.map((record) =>
            record.subQueryId === event.toolCallId && record.cancelledReason === undefined
              ? { ...record, cancelledReason: result.reason }
              : record,
          ),
        }));
      }
      return withTurn(state, call.turnId, (turn) => {
        const known = turn.subQueries.some((sub) => sub.id === event.toolCallId);
        const stats = { candidates: result.candidates, keptCount: result.kept.length };
        return {
          ...turn,
          subQueries: known
            ? turn.subQueries.map((sub) => (sub.id === event.toolCallId ? { ...sub, ...stats } : sub))
            : // Results can land before the decomposer publishes its list.
              [...turn.subQueries, { id: event.toolCallId, text: "", source: "provisional" as const, ...stats }],
          evidence: mergeEvidence(turn.evidence, result.kept),
        };
      });
    }

    case EventType.TEXT_MESSAGE_START: {
      const id = parseMessageId(event.messageId);
      if (!id) return state;
      return withTurn(state, id.turnId, (turn) => ({
        ...withVersion(turn, id.version, (draft) => draft),
        activeVersion: id.version,
        status: "answering",
      }));
    }

    case EventType.TEXT_MESSAGE_CONTENT: {
      const id = parseMessageId(event.messageId);
      if (!id) return state;
      return withTurn(state, id.turnId, (turn) =>
        withVersion(turn, id.version, (draft) => ({ ...draft, body: draft.body + event.delta })),
      );
    }

    case EventType.RUN_FINISHED: {
      const turnId = runTurn(state);
      const closed = { ...state, openRun: null };
      if (!turnId) return closed;
      return withTurn(closed, turnId, (turn) => ({
        ...turn,
        status: turn.status === "error" ? "error" : "complete",
      }));
    }

    case EventType.RUN_ERROR: {
      const turnId = runTurn(state);
      const failed: AppState = {
        ...state,
        openRun: null,
        lastError: { code: event.code ?? "run_error", message: event.message },
      };
      if (!turnId) return failed;
      return withTurn(failed, turnId, (turn) => ({ ...turn, status: "error", errorMessage: event.message }));
    }

    default:
      return state;
  }
}
