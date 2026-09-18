import type { AnswerVersion, AppState, ControllerDecisionRecord, Turn } from "@/store/types";
import type { Hit } from "@/types/events";

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
