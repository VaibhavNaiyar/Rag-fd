import type { AnswerVersion, AppState, ControllerDecisionRecord, Turn } from "@/store/types";
import { FIXTURE_FAMILIES } from "@/lib/constants";
import { turnKey } from "@/store/reducer";
import type { TraceEntry, TraceStatus } from "@/store/traceSlice";
import type { Decision, FixtureInfo, Hit } from "@/types/events";
import type { TraceRecord } from "@/types/trace";

/**
 * Derived reads.
 *
 * Anything computed from a turn lives here so the chat, the trace rail and the
 * metrics bar cannot disagree about what the same turn means.
 */

/** The turn the trace rail describes: the newest one. */
export function selectActiveTurn(state: AppState): Turn | null {
  return state.turns.length === 0 ? null : (state.turns[state.turns.length - 1] ?? null);
}

export function selectVersion(turn: Turn, version?: number): AnswerVersion | null {
  const wanted = version ?? turn.activeVersion;
  return turn.versions.find((candidate) => candidate.version === wanted) ?? null;
}

export function latestVersion(turn: Turn): AnswerVersion | null {
  return turn.versions.length === 0 ? null : (turn.versions[turn.versions.length - 1] ?? null);
}

export function latestDecision(turn: Turn): ControllerDecisionRecord | null {
  return turn.decisions.length === 0 ? null : (turn.decisions[turn.decisions.length - 1] ?? null);
}

/**
 * How long before the user stopped speaking the first retrieval fired.
 *
 * Positive is the G2 win. Returns null while the utterance is still open, or on
 * a suppressed turn where no retrieval ever ran.
 */
export function retrievalLeadMs(turn: Turn): number | null {
  if (turn.utteranceEndMs === null || turn.firstRetrievalMs === null) return null;
  return turn.utteranceEndMs - turn.firstRetrievalMs;
}

export function isSuppressed(turn: Turn): boolean {
  return (
    turn.retrievals.length === 0 &&
    turn.decisions.some((decision) => decision.decision === "suppress")
  );
}

/** Evidence bucketed by the sub-query that retrieved it, in sub-query order. */
export interface EvidenceGroup {
  subQueryId: string;
  label: string;
  hits: Hit[];
}

export function groupEvidence(turn: Turn): EvidenceGroup[] {
  if (turn.evidence.length === 0) return [];

  const groups: EvidenceGroup[] = turn.subQueries.map((sub, index) => ({
    subQueryId: sub.id,
    label: sub.text || `Sub-query ${index + 1}`,
    hits: turn.evidence.filter((hit) => hit.subQueryIds.includes(sub.id)),
  }));

  // Anything whose sub-query never got published still has to be visible.
  const claimed = new Set(groups.flatMap((group) => group.hits.map((hit) => hit.chunkId)));
  const orphans = turn.evidence.filter((hit) => !claimed.has(hit.chunkId));
  if (orphans.length > 0) {
    groups.push({ subQueryId: "__unassigned", label: "Unassigned", hits: orphans });
  }

  return groups.filter((group) => group.hits.length > 0);
}

/** Look a citation marker up against the evidence the engine actually returned. */
export function resolveCitation(hits: Hit[], marker: string): Hit | null {
  const normalised = marker.trim().toLowerCase();
  return hits.find((hit) => hit.citation.trim().toLowerCase() === normalised) ?? null;
}

export interface SessionMetrics {
  turns: number;
  /** Mean time to first token across completed turns, in ms. */
  meanTtftMs: number | null;
  /** Mean retrieval lead across turns that retrieved, in ms. */
  meanLeadMs: number | null;
  /** Share of turns whose first retrieval preceded the utterance end. */
  earlyRetrievalRate: number | null;
  totalUsd: number;
  totalTokens: number;
  meanSupportRate: number | null;
  fabricatedCitations: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Session-wide rollup.
 *
 * Takes the turns rather than the whole state: it builds a new object on every
 * call, so it must never be passed straight to `useAppStore` as a selector.
 */
export function selectSessionMetrics(turns: Turn[]): SessionMetrics {
  const completed = turns.filter((turn) => turn.status === "complete");
  const retrieving = turns.filter((turn) => !isSuppressed(turn) && turn.retrievals.length > 0);
  const leads = retrieving.map(retrievalLeadMs).filter((lead): lead is number => lead !== null);
  const supports = turns
    .map((turn) => latestVersion(turn)?.citationSupportRate)
    .filter((rate): rate is number => rate !== undefined);

  return {
    turns: turns.length,
    meanTtftMs: mean(completed.map((turn) => turn.latencyMs?.firstToken ?? 0)),
    meanLeadMs: mean(leads),
    earlyRetrievalRate:
      leads.length === 0 ? null : leads.filter((lead) => lead > 0).length / leads.length,
    totalUsd: completed.reduce((sum, turn) => sum + (turn.cost?.turnUsd ?? 0), 0),
    totalTokens: completed.reduce((sum, turn) => sum + (turn.cost?.turnTokens ?? 0), 0),
    meanSupportRate: mean(supports),
    fabricatedCitations: turns.reduce(
      (sum, turn) => sum + (latestVersion(turn)?.fabricatedCitations ?? 0),
      0,
    ),
  };
}

export interface FeaturedFixture {
  fixture: FixtureInfo;
  label: string;
  proves: string;
  hotkey: string;
}

/**
 * One fixture per family, in {@link FIXTURE_FAMILIES} order, at most four: the
 * replay keys 1–4 and the idle-screen chips. A family whose point needs an earlier
 * answer (a late detail, a reformat) is represented by a multi-turn case.
 */
export function featuredFixtures(fixtures: FixtureInfo[]): FeaturedFixture[] {
  const featured: FeaturedFixture[] = [];
  for (const { family, label, proves } of FIXTURE_FAMILIES) {
    const members = fixtures.filter((fixture) => fixture.family === family);
    const pick = members.find((fixture) => fixture.turns.length > 1) ?? members[0];
    if (pick) featured.push({ fixture: pick, label, proves, hotkey: String(featured.length + 1) });
    if (featured.length === 4) break;
  }
  return featured;
}

/**
 * P5-F13: selectors safe to pass straight to `useAppStore(selector)`.
 *
 * `state.turns` (SD-01) now holds every turn from every session this store
 * instance has seen, not just the active one, so the Console's ledger needs a
 * session-scoped read; the Inspector needs the live turn and its fetched trace
 * together; a scorecard needs to not rebuild its object on every unrelated
 * store change. Each cache below is a single slot or a `WeakMap` keyed by the
 * exact reference zustand hands it, which is stable across a render that did
 * not touch the relevant state (the reducer and the slices always replace
 * rather than mutate) — so `useAppStore(selectX)` never loops on its own output.
 */

let sessionTurnsCache: { turns: Turn[]; sessionId: string | null; result: Turn[] } | null = null;

/** Turns belonging to the active session, in order — what the Console's ledger renders. `null` (no active session yet) shows everything seen so far, which is exactly the turns array on a fresh connection. */
export function selectSessionTurns(state: AppState): Turn[] {
  if (sessionTurnsCache && sessionTurnsCache.turns === state.turns && sessionTurnsCache.sessionId === state.activeSessionId) {
    return sessionTurnsCache.result;
  }
  const result = state.activeSessionId === null ? state.turns : state.turns.filter((turn) => turn.sessionId === state.activeSessionId);
  sessionTurnsCache = { turns: state.turns, sessionId: state.activeSessionId, result };
  return result;
}

export interface TurnSummary {
  mode: Decision | null;
  searches: number;
  claims: number;
  ttftMs: number | null;
  completeMs: number | null;
  costUsd: number | null;
}

const turnSummaryCache = new WeakMap<Turn, TurnSummary>();

/** The one-line summary (P6-F15: `mode · searches · claims · ttft · complete · cost`). */
export function selectTurnSummary(turn: Turn): TurnSummary {
  const cached = turnSummaryCache.get(turn);
  if (cached) return cached;
  const version = latestVersion(turn);
  const summary: TurnSummary = {
    mode: latestDecision(turn)?.decision ?? null,
    searches: turn.retrievals.length,
    claims: version?.claims.length ?? 0,
    ttftMs: turn.latencyMs?.firstToken ?? null,
    completeMs: turn.latencyMs?.complete ?? null,
    costUsd: turn.cost?.turnUsd ?? null,
  };
  turnSummaryCache.set(turn, summary);
  return summary;
}

const sessionMetricsCache = new WeakMap<Turn[], SessionMetrics>();

/** {@link selectSessionMetrics}, memoised on the turns array's identity — safe to select straight off the store, unlike the underlying function (see its own doc comment). */
export function selectSessionMetricsMemo(turns: Turn[]): SessionMetrics {
  const cached = sessionMetricsCache.get(turns);
  if (cached) return cached;
  const computed = selectSessionMetrics(turns);
  sessionMetricsCache.set(turns, computed);
  return computed;
}

export interface MergedTurn {
  /** The live, streaming record — null if this turn was never seen live in this store instance (opened from the Traces table instead). */
  live: Turn | null;
  /** The fetched `/trace` record — null until `ensureTrace` resolves, or if it never will (evicted, errored). */
  trace: TraceRecord | null;
  traceStatus: TraceStatus;
}

const mergedTurnCache = new Map<string, { turns: Turn[]; traces: Record<string, TraceEntry>; result: MergedTurn }>();

/**
 * `mergeTurn`: what the Inspector reads for one turn — the live record (if this
 * session is still open) and its trace record (if fetched), together. Bounded in
 * practice by how many distinct turns a session opens the Inspector on, the same
 * order of magnitude as `state.turns` itself.
 */
export function selectMergedTurn(turns: Turn[], traces: Record<string, TraceEntry>, sessionId: string, turnId: string): MergedTurn {
  const key = turnKey(sessionId, turnId);
  const cached = mergedTurnCache.get(key);
  if (cached && cached.turns === turns && cached.traces === traces) return cached.result;

  const live = turns.find((turn) => turn.sessionId === sessionId && turn.id === turnId) ?? null;
  const entry = traces[key];
  const result: MergedTurn = { live, trace: entry?.record ?? null, traceStatus: entry?.status ?? "idle" };
  mergedTurnCache.set(key, { turns, traces, result });
  return result;
}
