import type { Decision, RetrievalTrigger, SubQuerySource } from "@/types/events";

/**
 * Visual metadata for pipeline states, defined once.
 *
 * The timeline, the transcript strip and the suppressed note all read from here,
 * so a decision can never be blue in one place and grey in another. Every entry
 * carries a text label as well as a colour — §11 forbids encoding state in
 * colour alone, and a grayscale screenshot has to stay readable.
 */
export interface StateVisual {
  label: string;
  /** CSS custom property, so themes resolve it rather than the component. */
  colorVar: string;
  /** Tailwind classes for a pill rendering of this state. */
  pillClass: string;
}

export const DECISION_VISUALS: Record<Decision, StateVisual> = {
  wait: {
    label: "Wait",
    colorVar: "var(--state-wait)",
    pillClass: "bg-sunken text-ink-muted border-line",
  },
  retrieve: {
    label: "Retrieve",
    colorVar: "var(--state-retrieve)",
    pillClass: "bg-primary-soft text-primary-ink border-edge-primary",
  },
  suppress: {
    label: "Suppress",
    colorVar: "var(--state-suppress)",
    pillClass: "bg-sunken text-ink-muted border-line",
  },
  refine: {
    label: "Refine",
    colorVar: "var(--state-refine)",
    pillClass: "bg-primary-soft text-brand border-edge-brand",
  },
};

export const TRIGGER_LABELS: Record<RetrievalTrigger, string> = {
  provisional: "provisional",
  multi_intent: "multi-intent",
  refine: "refine",
};

export const SOURCE_LABELS: Record<SubQuerySource, string> = {
  provisional: "provisional",
  decomposed: "decomposed",
};

/** Human-readable controller reason codes; falls back to the raw code. */
const REASON_LABELS: Record<string, string> = {
  insufficient_content: "insufficient content",
  intent_stable: "intent stable",
  intent_unstable: "intent still forming",
  multi_intent_detected: "multi-intent detected",
  presentation_only: "presentation-only request",
  no_new_entities: "no new entities",
  late_constraint: "late constraint arrived",
  duplicate_query: "duplicate of an in-flight query",
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}
