"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { Segmented } from "@/components/ui/Segmented";
import { StatusDot } from "@/components/ui/StatusDot";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMs } from "@/lib/format";
import { DECISION_LABELS, reasonLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { Decision } from "@/types/events";
import type { TraceDecision } from "@/types/trace";

type Filter = Decision | "all";

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wait", label: "Wait" },
  { value: "retrieve", label: "Retrieve" },
  { value: "refine", label: "Refine" },
  { value: "suppress", label: "Suppress" },
];

/** The full, chronological decision log (P7-F06): every verdict the controller made, in time order, with its confidence and its signals on request. DOM order is time order, so a screen reader hears it in the order it happened, independent of any visual filtering. */
export function ControllerLog({ decisions }: { decisions: readonly TraceDecision[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  if (decisions.length === 0) {
    return (
      <EmptyState title="No decisions" level={4}>
        The controller recorded no decisions for this turn.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <Segmented label="Filter by decision" size="sm" value={filter} onValueChange={setFilter} options={FILTERS} />
      <ol className="space-y-1">
        {decisions.map((decision, index) => {
          if (filter !== "all" && decision.decision !== filter) return null;
          const meta = DECISION_LABELS[decision.decision];
          const open = openId === index;
          const hasSignals = Object.keys(decision.signals).length > 0;
          return (
            <li key={index} className="rounded-2 border border-line">
              <button
                type="button"
                aria-expanded={hasSignals ? open : undefined}
                disabled={!hasSignals}
                onClick={() => setOpenId(open ? null : index)}
                className="flex w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-left text-caption disabled:cursor-default"
              >
                <span className="w-14 shrink-0 text-right font-mono tabular text-ink-muted">{formatMs(decision.at_ms)}</span>
                <StatusDot shape={meta.shape} tone={meta.tone} label={meta.label} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink-body">{meta.label}</span>
                  <span className="text-ink-muted"> · {reasonLabel(decision.reason)}</span>
                </span>
                <span className="shrink-0 font-mono tabular text-ink-muted">{decision.confidence.toFixed(2)}</span>
                {hasSignals && <ChevronRight size={12} aria-hidden className={cn("shrink-0 text-ink-muted transition-transform", open && "rotate-90")} />}
              </button>
              {open && hasSignals && (
                <div className="border-t border-line px-2.5 py-2">
                  <JsonViewer value={decision.signals} label={`Signals for the ${meta.label.toLowerCase()} decision at ${formatMs(decision.at_ms)}`} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
