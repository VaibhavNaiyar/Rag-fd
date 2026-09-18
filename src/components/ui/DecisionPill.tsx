"use client";

import { Clock, RefreshCw, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/cn";
import { DECISION_VISUALS, reasonLabel } from "@/lib/decisions";
import type { Decision } from "@/types/events";

const ICONS: Record<Decision, typeof Clock> = {
  wait: Clock,
  retrieve: Search,
  suppress: SearchX,
  refine: RefreshCw,
};

export interface DecisionPillProps {
  decision: Decision;
  reason?: string;
  confidence?: number;
  className?: string;
}

/**
 * The controller's current verdict.
 *
 * Icon + label + reason, never colour alone — a grayscale frame of the video
 * still has to say which decision was taken and why.
 */
export function DecisionPill({ decision, reason, confidence, className }: DecisionPillProps) {
  const visual = DECISION_VISUALS[decision];
  const Icon = ICONS[decision];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1",
        "text-caption font-medium leading-4 whitespace-nowrap",
        visual.pillClass,
        className,
      )}
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      {visual.label}
      {reason && <span className="font-normal opacity-80">· {reasonLabel(reason)}</span>}
      {confidence !== undefined && (
        <span className="font-mono tabular opacity-70">{confidence.toFixed(2)}</span>
      )}
    </span>
  );
}
