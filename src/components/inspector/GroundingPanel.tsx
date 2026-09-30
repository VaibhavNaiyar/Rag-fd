"use client";

import { KeyValueGrid } from "@/components/ui/KeyValueGrid";
import { MetricCell } from "@/components/ui/MetricCell";
import { ThresholdMeter } from "@/components/ui/ThresholdMeter";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCount, formatRate } from "@/lib/format";
import type { TraceRecord } from "@/types/trace";

/**
 * The grounding funnel (P7-F12): how many claims the model wrote, how many the
 * verifier could support, how many were demoted, and the citation mechanics
 * (auto-cited vs. recited, ungrounded numbers, fabricated markers).
 *
 * The 0.85 target is the same figure the legacy `MetricsBar` used; `lib/thresholds.ts`
 * (P9-F01) is the formal, sourced version of this and every other target — this
 * meter switches to reading it once that file exists.
 */
const SUPPORT_TARGET = 0.85;

export function GroundingPanel({ record }: { record: TraceRecord }) {
  const grounding = record.answer?.grounding;
  if (!grounding) {
    return (
      <EmptyState title="No grounding record" level={4}>
        This turn produced no answer version to ground, or the trace predates this field.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ThresholdMeter
        label="Citation support rate"
        value={record.citation_support_rate}
        target={SUPPORT_TARGET}
        direction="atLeast"
        format={(v) => formatRate(v)}
        showTable
      />

      <KeyValueGrid label="Grounding funnel">
        <MetricCell label="Generated claims" value={grounding.generated_claims ?? null} provenance="measured" />
        <MetricCell label="Supported" value={grounding.supported_claims ?? null} tone="ok" provenance="measured" />
        <MetricCell label="Demoted" value={grounding.demoted_claims ?? null} tone={((grounding.demoted_claims ?? 0) > 0) ? "warn" : "default"} provenance="measured" />
        <MetricCell label="Auto-cited" value={grounding.auto_cited ?? null} provenance="measured" />
        <MetricCell label="Recited" value={grounding.recited ?? null} provenance="measured" />
        <MetricCell label="Ungrounded numbers" value={grounding.ungrounded_numbers ?? null} tone={((grounding.ungrounded_numbers ?? 0) > 0) ? "warn" : "default"} provenance="measured" />
        <MetricCell label="Fabricated, shipped" value={record.fabricated_citations} tone={record.fabricated_citations > 0 ? "error" : "ok"} provenance="measured" />
        <MetricCell label="Fabricated, blocked" value={record.fabricated_citations_blocked} tone="ok" provenance="measured" />
      </KeyValueGrid>

      <p className="text-caption text-ink-muted">Verifier: {grounding.verifier ?? "—"}</p>

      {record.uncertainty.length > 0 && (
        <div>
          <p className="mb-1 text-caption font-semibold text-ink-muted">{formatCount(record.uncertainty.length)} uncertainty note{record.uncertainty.length === 1 ? "" : "s"}</p>
          <ul className="space-y-1 pl-4 text-caption text-ink-body [list-style:disc]">
            {record.uncertainty.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
