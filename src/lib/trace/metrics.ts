import type { TraceRecord } from "@/types/trace";

/**
 * Turn and session aggregates over `/trace` records — what the Metrics view
 * (P9) reports. Every number here is read straight off the trace contract;
 * nothing is estimated or recomputed from a model. Percentiles use the
 * nearest-rank method (deterministic, no interpolation to explain).
 */

export interface Percentiles {
  p50: number | null;
  p90: number | null;
  mean: number | null;
  n: number;
}

const EMPTY_PERCENTILES: Percentiles = { p50: null, p90: null, mean: null, n: 0 };

/** Nearest-rank p50/p90 and the mean, over the finite values only. Empty or all-non-finite input is every field null, n 0. */
export function percentiles(values: readonly (number | null | undefined)[]): Percentiles {
  const finite = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (finite.length === 0) return EMPTY_PERCENTILES;
  const at = (p: number) => finite[Math.min(finite.length - 1, Math.floor(p * finite.length))]!;
  const mean = finite.reduce((sum, v) => sum + v, 0) / finite.length;
  return { p50: at(0.5), p90: at(0.9), mean, n: finite.length };
}

/** Retrieval lead in ms, positive = the first search fired before the utterance ended (the G2 win). Null when there was no retrieval or the utterance has no end (a suppressed or still-open turn). */
export function leadMs(record: TraceRecord): number | null {
  const rel = record.latency_ms?.first_retrieval_rel_end;
  return rel === null || rel === undefined ? null : -rel;
}

export interface TraceMetrics {
  turns: number;
  ttft: Percentiles;
  complete: Percentiles;
  lead: Percentiles;
  costUsd: Percentiles;
  tokens: Percentiles;
  supportRate: Percentiles;
  totalClaims: number;
  totalFlaggedChunks: number;
  totalUncertain: number;
  totalFabricatedCitations: number;
  totalFabricatedBlocked: number;
  byMode: Record<string, number>;
}

/** Aggregates a set of trace records (a session, a scope, the whole loaded ring) into what the Metrics view reports. */
export function aggregateTraceMetrics(records: readonly TraceRecord[]): TraceMetrics {
  const byMode: Record<string, number> = {};
  for (const record of records) {
    const mode = record.mode ?? "unknown";
    byMode[mode] = (byMode[mode] ?? 0) + 1;
  }

  return {
    turns: records.length,
    ttft: percentiles(records.map((r) => r.latency_ms?.first_token_after_end)),
    complete: percentiles(records.map((r) => r.latency_ms?.complete_after_end)),
    lead: percentiles(records.map(leadMs)),
    costUsd: percentiles(records.map((r) => r.cost?.turnUsd)),
    tokens: percentiles(records.map((r) => r.cost?.turnTokens)),
    supportRate: percentiles(records.map((r) => r.citation_support_rate)),
    totalClaims: records.reduce((sum, r) => sum + (r.answer?.claim_count ?? 0), 0),
    totalFlaggedChunks: records.reduce((sum, r) => sum + (r.fusion?.flagged_chunk_ids.length ?? 0), 0),
    totalUncertain: records.reduce((sum, r) => sum + r.uncertainty.length, 0),
    totalFabricatedCitations: records.reduce((sum, r) => sum + r.fabricated_citations, 0),
    totalFabricatedBlocked: records.reduce((sum, r) => sum + r.fabricated_citations_blocked, 0),
    byMode,
  };
}

export interface StepShare {
  step: "listen" | "plan" | "retrieve" | "synthesise";
  medianMs: number | null;
  sharePct: number | null;
}

/**
 * Median duration of each named window across a set of turns, and its share of
 * the median total — the "shares sum to 100%" the Step Time table (P9-F07)
 * shows. A turn missing a step (no retrieval on a suppressed turn, no plan when
 * decomposition never ran) simply does not contribute a sample to that step.
 */
export function stepTimeShares(records: readonly TraceRecord[]): StepShare[] {
  const listens: number[] = [];
  const plans: number[] = [];
  const retrieves: number[] = [];
  const synths: number[] = [];

  for (const record of records) {
    const end = record.utterance_end_ms;
    const planMs = record.decomposition?.ms ?? null;
    const firstToken = record.latency_ms?.first_token_abs ?? null;
    const done = record.latency_ms?.complete_abs ?? end ?? null;
    const firstSearch = record.first_retrieval_ms;

    if (end !== null) listens.push(end);
    if (planMs !== null) plans.push(planMs);
    if (firstSearch !== null && (firstToken !== null || done !== null)) retrieves.push((firstToken ?? done!) - firstSearch);
    if (firstToken !== null && done !== null) {
      const start = end !== null && planMs !== null ? Math.min(end + planMs, firstToken) : firstToken;
      synths.push(Math.max(0, done - start));
    }
  }

  const median = (values: number[]) => (values.length === 0 ? null : percentiles(values).p50);
  const medians: Record<StepShare["step"], number | null> = {
    listen: median(listens),
    plan: median(plans),
    retrieve: median(retrieves),
    synthesise: median(synths),
  };
  const total = Object.values(medians).reduce<number>((sum, v) => sum + (v ?? 0), 0);

  return (["listen", "plan", "retrieve", "synthesise"] as const).map((step) => ({
    step,
    medianMs: medians[step],
    sharePct: total > 0 && medians[step] !== null ? (medians[step]! / total) * 100 : null,
  }));
}
