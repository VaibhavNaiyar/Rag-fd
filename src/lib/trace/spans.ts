import type { Decision } from "@/types/events";
import type { TraceDecision, TraceRecord, TraceRetrievalResult, TraceSignals } from "@/types/trace";

/**
 * The trace, as a span tree — §3.7 of PHASES.md, which mirrors the engine's own
 * OpenTelemetry exporter (`Rag-bd/src/slr/telemetry/otel.py:OtelExporter._export`)
 * so a browser waterfall and a collector dashboard agree on what "retrieve" means.
 *
 * Every window is `[startMs, endMs]` relative to `started_at` (turn start = 0).
 * `provenance` says how honest a window is: `measured` (both ends read off a real
 * timestamp), `modelled` (a real duration placed at an inferred start — Plan has
 * no start event of its own), or `unavailable` (no timing exists at all — rerank,
 * fuse, verify and a refine's detail work are real steps with no window; they are
 * `details` rows on their parent, never bars — R6, never invent a timing).
 */

export type Provenance = "measured" | "modelled" | "unavailable";

export type SpanKind = "turn" | "listen" | "plan" | "retrieve" | "search" | "synthesise";

export interface SpanMetrics {
  latencyMs: number | null;
  tokens: number | null;
  costUsd: number | null;
}

export interface SpanDetail {
  label: string;
  value: string;
}

export interface DecisionMarker {
  kind: "decision";
  id: string;
  atMs: number;
  decision: Decision;
  reason: string;
  confidence: number;
  query: string | null;
  signals: TraceSignals;
}

export interface FirstTokenMarker {
  kind: "first_token";
  id: string;
  atMs: number;
}

export type SpanMarker = DecisionMarker | FirstTokenMarker;

export interface SpanNode {
  id: string;
  kind: SpanKind;
  label: string;
  colorVar: string;
  /** Null when the window cannot be placed at all (the step never ran, or the data to place it is missing). */
  startMs: number | null;
  endMs: number | null;
  provenance: Provenance;
  cancelled: boolean;
  cancelReason: string | null;
  children: SpanNode[];
  markers: SpanMarker[];
  details: SpanDetail[];
  metrics: SpanMetrics;
}

function node(partial: Omit<SpanNode, "children" | "markers" | "details" | "metrics" | "cancelled" | "cancelReason"> & Partial<Pick<SpanNode, "children" | "markers" | "details" | "cancelled" | "cancelReason">>): SpanNode {
  return {
    children: [],
    markers: [],
    details: [],
    cancelled: false,
    cancelReason: null,
    metrics: { latencyMs: partial.startMs !== null && partial.endMs !== null ? partial.endMs - partial.startMs : null, tokens: null, costUsd: null },
    ...partial,
  };
}

function decisionMarker(decision: TraceDecision, index: number): DecisionMarker {
  return {
    kind: "decision",
    id: `decision-${index}-${decision.at_ms}`,
    atMs: decision.at_ms,
    decision: decision.decision,
    reason: decision.reason,
    confidence: decision.confidence,
    query: decision.query ?? null,
    signals: decision.signals,
  };
}

/** One `retrieve` child per search-launch event: cancelled (matched to its cancel event) or completed (matched to its `retrieval[]` result, which carries the measured `ms`). Order follows `retrieval_events`, so it reads as the launches happened. */
function searchChildren(record: TraceRecord): SpanNode[] {
  const byId = new Map<string, TraceRetrievalResult>(record.retrieval.map((r) => [r.sub_query_id, r]));
  const cancels = new Map<string, { atMs: number; reason: string }>();
  for (const event of record.retrieval_events) {
    if ("event" in event) cancels.set(event.sub_query_id, { atMs: event.at_ms, reason: event.reason });
  }

  const children: SpanNode[] = [];
  for (const event of record.retrieval_events) {
    if ("event" in event) continue; // a cancellation annotates its launch below, it is not its own child
    const cancel = cancels.get(event.sub_query_id);
    const result = byId.get(event.sub_query_id);
    const label = event.trigger === "full_utterance" ? "full utterance" : event.query;

    if (cancel) {
      children.push(
        node({
          id: `search-${event.sub_query_id}`,
          kind: "search",
          label,
          colorVar: "var(--span-retrieve)",
          startMs: event.at_ms,
          endMs: cancel.atMs,
          provenance: "measured",
          cancelled: true,
          cancelReason: cancel.reason,
          details: [{ label: "trigger", value: event.trigger }, { label: "sub-query", value: event.sub_query_id }],
        }),
      );
      continue;
    }

    if (result) {
      children.push(
        node({
          id: `search-${event.sub_query_id}`,
          kind: "search",
          label,
          colorVar: "var(--span-retrieve)",
          startMs: event.at_ms,
          endMs: event.at_ms + result.ms,
          provenance: "measured",
          details: [
            { label: "trigger", value: event.trigger },
            { label: "candidates", value: String(result.candidates) },
            { label: "kept", value: String(result.kept.length) },
            { label: "reused", value: result.reused ? "yes" : "no" },
            { label: "reranked", value: result.reranked ? "yes" : "no" },
          ],
        }),
      );
      continue;
    }

    // Launched, neither a result nor a cancellation landed yet (a mid-flight or truncated record).
    children.push(
      node({
        id: `search-${event.sub_query_id}`,
        kind: "search",
        label,
        colorVar: "var(--span-retrieve)",
        startMs: event.at_ms,
        endMs: null,
        provenance: "unavailable",
        details: [{ label: "trigger", value: event.trigger }],
      }),
    );
  }
  return children;
}

/** `buildSpanTree`: the turn root and its four named children, exactly as `otel.py` windows them. */
export function buildSpanTree(record: TraceRecord): SpanNode {
  const endMs = record.utterance_end_ms;
  const latency = record.latency_ms;
  const firstToken = latency?.first_token_abs ?? null;
  const doneMs = latency?.complete_abs ?? endMs ?? 0;
  const planMs = record.decomposition?.ms ?? null;

  const children: SpanNode[] = [];

  if (endMs !== null) {
    const listen = node({
      id: "listen",
      kind: "listen",
      label: "Listen",
      colorVar: "var(--span-listen)",
      startMs: 0,
      endMs,
      provenance: "measured",
      markers: record.decisions.map(decisionMarker),
      details: [{ label: "chunks", value: String(record.chunks.length) }],
    });
    children.push(listen);

    if (planMs !== null) {
      children.push(
        node({
          id: "plan",
          kind: "plan",
          label: "Plan",
          colorVar: "var(--span-plan)",
          startMs: endMs,
          endMs: endMs + planMs,
          // The duration is a real measurement; the start is inferred at the utterance end, not read off an event.
          provenance: "modelled",
          details: [
            { label: "method", value: record.decomposition?.method ?? "—" },
            { label: "readings", value: String(record.decomposition?.raw?.length ?? record.sub_queries.length) },
          ],
        }),
      );
    }
  }

  if (record.first_retrieval_ms !== null) {
    const retrieveEnd = firstToken ?? doneMs;
    const retrieve = node({
      id: "retrieve",
      kind: "retrieve",
      label: "Retrieve",
      colorVar: "var(--span-retrieve)",
      startMs: record.first_retrieval_ms,
      endMs: retrieveEnd,
      provenance: "measured",
      children: searchChildren(record),
      details: record.fusion
        ? [
            { label: "fused", value: String(record.fusion.final_count) },
            { label: "quota applied", value: record.fusion.quota_applied ? "yes" : "no" },
            { label: "full corpus search", value: record.fusion.full_corpus_search ? "yes" : "no" },
            { label: "flagged", value: String(record.fusion.flagged_chunk_ids.length) },
          ]
        : [],
    });
    children.push(retrieve);
  }

  if (firstToken !== null) {
    const modelledStart = endMs !== null && planMs !== null ? endMs + planMs : firstToken;
    const synthesise = node({
      id: "synthesise",
      kind: "synthesise",
      label: "Synthesise",
      colorVar: "var(--span-synthesise)",
      startMs: Math.min(modelledStart, firstToken),
      endMs: doneMs,
      provenance: "measured",
      markers: [{ kind: "first_token", id: "first-token", atMs: firstToken }],
      details: record.answer?.grounding
        ? [
            { label: "claims", value: String(record.answer.claim_count) },
            { label: "supported", value: String(record.answer.grounding.supported_claims ?? "—") },
            { label: "auto-cited", value: String(record.answer.grounding.auto_cited ?? "—") },
            { label: "verifier", value: record.answer.grounding.verifier ?? "—" },
          ]
        : [],
    });
    children.push(synthesise);
  }

  const turnMetrics: SpanMetrics = {
    latencyMs: doneMs,
    tokens: record.cost?.turnTokens ?? null,
    costUsd: record.cost?.turnUsd ?? null,
  };

  return {
    ...node({
      id: "turn",
      kind: "turn",
      label: `Turn ${record.turn_id}`,
      colorVar: "var(--ink)",
      startMs: 0,
      endMs: doneMs,
      provenance: "measured",
      children,
      details: record.errors.length > 0 ? record.errors.map((message, i) => ({ label: `error ${i + 1}`, value: message })) : [],
    }),
    metrics: turnMetrics,
  };
}

/** Every span node in the tree, depth-first, turn first. */
export function flattenSpans(root: SpanNode): SpanNode[] {
  const out: SpanNode[] = [];
  const visit = (n: SpanNode) => {
    out.push(n);
    for (const child of n.children) visit(child);
  };
  visit(root);
  return out;
}
