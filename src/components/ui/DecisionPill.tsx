"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StatusDot, type StatusShape, type StatusTone } from "@/components/ui/StatusDot";
import { DECISION_VISUALS, reasonLabel } from "@/lib/decisions";
import type { Decision } from "@/types/events";

/** Shape and colour together (PHASES.md §3.3): ring, disc, diamond, barred circle. */
const MARKS: Record<Decision, { shape: StatusShape; dot: StatusTone; tone: BadgeTone }> = {
  wait: { shape: "ring", dot: "wait", tone: "neutral" },
  retrieve: { shape: "filled", dot: "retrieve", tone: "accent" },
  suppress: { shape: "barred", dot: "suppress", tone: "warn" },
  refine: { shape: "diamond", dot: "refine", tone: "accent" },
};

export interface DecisionPillProps {
  decision: Decision;
  reason?: string;
  confidence?: number;
  className?: string;
}

/**
 * The controller's current verdict: a mark whose shape names the decision, the word,
 * and the reason. Colour reinforces it and is never the only signal, so a grayscale
 * frame of the video still says which decision was taken and why.
 */
export function DecisionPill({ decision, reason, confidence, className }: DecisionPillProps) {
  const mark = MARKS[decision];
  return (
    <Badge tone={mark.tone} wrap glyph={<StatusDot decorative shape={mark.shape} tone={mark.dot} />} className={className}>
      {DECISION_VISUALS[decision].label}
      {reason && <span className="font-normal"> · {reasonLabel(reason)}</span>}
      {confidence !== undefined && <span className="font-mono font-normal tabular"> {confidence.toFixed(2)}</span>}
    </Badge>
  );
}
