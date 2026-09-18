import { EVIDENCE_SNIPPET_CHARS } from "@/lib/constants";
import { titleFromText, truncate } from "@/lib/format";
import type { AnswerVersion, AppState, Turn } from "@/store/types";
import type { Hit, ServerEvent } from "@/types/events";

/**
 * The event reducer.
 *
 * One branch per `ServerEvent` variant, with a `never` check in `default` — an
 * event type the engine adds and the UI forgets becomes a compile error rather
 * than a silently dropped trace, which is the whole point of gate G6.
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

/** Replace one turn, creating it if the engine referenced it before `turn.start`. */
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

  return { ...state, turns };
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

export function applyServerEvent(state: AppState, event: ServerEvent): AppState {
  switch (event.type) {
    case "session.ready":
      return {
        ...state,
        corpus: event.corpus,
        connection: "open",
        lastError: null,
        activeSessionId: state.activeSessionId ?? event.sessionId,
        sessions:
          state.sessions.length > 0
            ? state.sessions
            : [{ id: event.sessionId, title: "New session", updatedAt: Date.now(), turnCount: 0 }],
      };

    case "turn.start": {
      if (state.turns.some((turn) => turn.id === event.turnId)) return state;
      return { ...state, phase: "active", turns: [...state.turns, createTurn(event.turnId)] };
    }

    case "transcript.chunk": {
      const next = withTurn(state, event.turnId, (turn) => ({
        ...turn,
        transcript: [...turn.transcript, { text: event.text, atMs: event.atMs }],
      }));
      return touchSession({ ...next, phase: "active" }, event.text);
    }

    case "controller.decision":
      return withTurn(state, event.turnId, (turn) => ({
        ...turn,
        decisions: [
          ...turn.decisions,
          {
            decision: event.decision,
            reason: event.reason,
            atMs: event.atMs,
            ...(event.confidence === undefined ? {} : { confidence: event.confidence }),
          },
        ],
        status: event.decision === "retrieve" ? "retrieving" : turn.status,
      }));

    case "retrieval.started":
      return withTurn(state, event.turnId, (turn) => ({
        ...turn,
        retrievals: [
          ...turn.retrievals,
          { subQueryId: event.subQueryId, trigger: event.trigger, atMs: event.atMs },
        ],
        firstRetrievalMs:
          turn.firstRetrievalMs === null ? event.atMs : Math.min(turn.firstRetrievalMs, event.atMs),
        status: "retrieving",
      }));

    case "retrieval.cancelled":
      return withTurn(state, event.turnId, (turn) => ({
        ...turn,
        retrievals: turn.retrievals.map((record) =>
          record.subQueryId === event.subQueryId && record.cancelledReason === undefined
            ? { ...record, cancelledReason: event.reason }
            : record,
        ),
      }));

    case "utterance.end":
      return withTurn(state, event.turnId, (turn) => ({ ...turn, utteranceEndMs: event.atMs }));

    case "subqueries":
      return withTurn(state, event.turnId, (turn) => ({
        ...turn,
        subQueries: event.items.map((item) => {
          const prior = turn.subQueries.find((candidate) => candidate.id === item.id);
          return { ...item, ...(prior ? { candidates: prior.candidates, keptCount: prior.keptCount } : {}) };
        }),
      }));

    case "retrieval.result":
      return withTurn(state, event.turnId, (turn) => {
        const known = turn.subQueries.some((sub) => sub.id === event.subQueryId);
        const stats = { candidates: event.candidates, keptCount: event.kept.length };
        return {
          ...turn,
          subQueries: known
            ? turn.subQueries.map((sub) => (sub.id === event.subQueryId ? { ...sub, ...stats } : sub))
            : // Results can land before the decomposer publishes its list.
              [
                ...turn.subQueries,
                { id: event.subQueryId, text: "", source: "provisional" as const, ...stats },
              ],
          evidence: mergeEvidence(turn.evidence, event.kept),
        };
      });

    case "fusion.final":
      return withTurn(state, event.turnId, (turn) => ({
        ...turn,
        evidence: mergeEvidence(turn.evidence, event.hits),
        quotaApplied: event.quotaApplied,
        fullCorpusSearch: event.fullCorpusSearch,
      }));

    case "answer.token":
      return withTurn(state, event.turnId, (turn) => {
        const updated = withVersion(turn, event.version, (draft) => ({
          ...draft,
          body: draft.body + event.text,
          fullCorpusSearch: turn.fullCorpusSearch,
        }));
        return { ...updated, activeVersion: event.version, status: "answering" };
      });

    case "answer.version":
      return withTurn(state, event.turnId, (turn) => {
        const updated = withVersion(turn, event.version, (draft) => ({
          ...draft,
          parent: event.parent,
          claims: event.claims,
          preserved: event.preserved,
          mutated: event.mutated,
          uncertainty: event.uncertainty,
          citationSupportRate: event.citationSupportRate,
          fabricatedCitations: event.fabricatedCitations,
          fullCorpusSearch: turn.fullCorpusSearch,
          complete: true,
        }));
        // The newest version is what the reader should be looking at.
        return { ...updated, activeVersion: event.version };
      });

    case "turn.complete":
      return withTurn(state, event.turnId, (turn) => ({
        ...turn,
        latencyMs: event.latencyMs,
        cost: event.cost,
        status: "complete",
      }));

    case "error": {
      const withError = { ...state, lastError: { code: event.code, message: event.message } };
      if (!event.turnId) return withError;
      return withTurn(withError, event.turnId, (turn) => ({
        ...turn,
        status: "error",
        errorMessage: event.message,
      }));
    }

    default: {
      const unhandled: never = event;
      console.warn("[store] unhandled server event", unhandled);
      return state;
    }
  }
}
