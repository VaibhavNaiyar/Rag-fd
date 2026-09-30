import type { StatusShape, StatusTone } from "@/components/ui/StatusDot";
import { KNOWN_REASON_CODES, type Decision, type RetrievalTrigger, type SubQuerySource } from "@/types/events";

/**
 * Every label, glyph and tone the console draws from a decision, a trigger, a
 * reason code or a search-call state — one place, so the same code never reads
 * "multi-intent detected" in the timeline and "multi_intent_detected" in the log.
 *
 * `decisions.ts` re-exports the pieces the legacy UI still imports; this file is
 * the source of truth and the legacy re-export is deleted in P12.
 */

export interface DecisionVisual {
  label: string;
  shape: StatusShape;
  tone: StatusTone;
  colorVar: string;
  pillClass: string;
}

export const DECISION_LABELS: Record<Decision, DecisionVisual> = {
  wait: { label: "Wait", shape: "ring", tone: "wait", colorVar: "var(--state-wait)", pillClass: "bg-surface-2 text-ink-muted border-line" },
  retrieve: { label: "Retrieve", shape: "filled", tone: "retrieve", colorVar: "var(--state-retrieve)", pillClass: "bg-accent-soft text-accent-ink border-accent-edge" },
  suppress: { label: "Suppress", shape: "barred", tone: "suppress", colorVar: "var(--state-suppress)", pillClass: "bg-surface-2 text-ink-muted border-line" },
  refine: { label: "Refine", shape: "diamond", tone: "refine", colorVar: "var(--state-refine)", pillClass: "bg-accent-soft text-accent-ink border-accent-edge" },
};

export const TRIGGER_LABELS: Record<RetrievalTrigger, string> = {
  provisional: "provisional",
  multi_intent: "multi-intent",
  refine: "refine",
  full_utterance: "full utterance",
};

export const SOURCE_LABELS: Record<SubQuerySource, string> = {
  provisional: "provisional",
  decomposed: "decomposed",
};

/** Every reason code the rules controller can emit, human-readable. Exhaustive against `KNOWN_REASON_CODES`. */
export const REASON_LABELS: Record<(typeof KNOWN_REASON_CODES)[number], string> = {
  intent_stable: "intent stable",
  clause_complete: "clause complete",
  multi_intent_detected: "multi-intent detected",
  late_constraint: "late constraint arrived",
  insufficient_content: "insufficient content",
  awaiting_next_intent: "awaiting next intent",
  provisional_budget_spent: "provisional search budget spent",
  intent_unstable: "intent still forming",
  presentation_restructure: "presentation-only request",
  no_information_need: "no information need detected",
  utterance_complete: "utterance complete",
  topic_shift: "topic shifted away from the search",
  controller_error: "controller error, fell back to wait",
};

/** A search cancellation's reason (`retrieval_events[].event === "retrieval_cancelled"` and `SearchResult.cancelled`). */
export const CANCEL_REASON_LABELS: Record<string, string> = {
  presentation_only: "presentation-only turn",
  topic_shift: "topic shifted away from the search",
  cancelled: "cancelled",
};

/** Human-readable reason: a known code's label, a known cancel reason, or the raw code with underscores turned to spaces. */
export function reasonLabel(reason: string): string {
  const known = (REASON_LABELS as Record<string, string>)[reason];
  if (known) return known;
  const cancelled = CANCEL_REASON_LABELS[reason];
  if (cancelled) return cancelled;
  return reason.replace(/_/g, " ");
}

export type SearchCallState = "pending" | "running" | "kept" | "cancelled";

export interface SearchCallVisual {
  label: string;
  shape: StatusShape;
  tone: StatusTone;
}

export const SEARCH_CALL_LABELS: Record<SearchCallState, SearchCallVisual> = {
  pending: { label: "Pending", shape: "ring", tone: "neutral" },
  running: { label: "Searching", shape: "ring", tone: "retrieve" },
  kept: { label: "Complete", shape: "filled", tone: "ok" },
  cancelled: { label: "Cancelled", shape: "barred", tone: "warn" },
};
