"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { IconButton } from "@/components/ui/IconButton";
import { KeyValueGrid } from "@/components/ui/KeyValueGrid";
import { MetricCell } from "@/components/ui/MetricCell";
import { formatCount, formatLead, formatMs, formatUsd } from "@/lib/format";
import { leadMs } from "@/lib/trace/metrics";
import type { TraceRecord } from "@/types/trace";

export interface InspectorHeaderProps {
  record: TraceRecord;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  shareUrl: string;
}

/** Turn id, mode, controller, time and status, then the roll-up KPIs (P7-F03, replaces `MetricsBar`) — TTFT, complete, lead, cost, tokens, every one read straight off the trace. */
export function InspectorHeader({ record, onPrevious, onNext, shareUrl }: InspectorHeaderProps) {
  const lead = leadMs(record);

  return (
    <div className="space-y-3 border-b border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="Previous turn ([)" size="sm" icon={<ChevronLeft size={14} aria-hidden />} onClick={onPrevious ?? undefined} disabled={!onPrevious} />
        <IconButton label="Next turn (])" size="sm" icon={<ChevronRight size={14} aria-hidden />} onClick={onNext ?? undefined} disabled={!onNext} />
        <p className="min-w-0 flex-1 truncate font-mono text-caption text-ink-muted">{record.turn_id}</p>
        <CopyButton value={shareUrl} label="Copy a link to this turn" />
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
        <span className="font-medium text-ink">{record.mode ?? "unknown"}</span>
        <span>· controller {record.controller}</span>
        <span>· {new Date(record.started_at).toLocaleTimeString()}</span>
      </p>

      <KeyValueGrid label="Roll-up">
        <MetricCell label="TTFT" value={record.latency_ms?.first_token_after_end === null || record.latency_ms?.first_token_after_end === undefined ? null : formatMs(record.latency_ms.first_token_after_end)} provenance="measured" />
        <MetricCell label="Complete" value={record.latency_ms?.complete_after_end === null || record.latency_ms?.complete_after_end === undefined ? null : formatMs(record.latency_ms.complete_after_end)} provenance="measured" />
        <MetricCell label="Lead" value={lead === null ? null : formatLead(lead)} tone={lead !== null && lead > 0 ? "accent" : "default"} provenance="measured" />
        <MetricCell label="Cost" value={record.cost ? formatUsd(record.cost.turnUsd) : null} provenance="measured" />
        <MetricCell label="Tokens" value={record.cost ? formatCount(record.cost.turnTokens) : null} provenance="measured" />
      </KeyValueGrid>
    </div>
  );
}
