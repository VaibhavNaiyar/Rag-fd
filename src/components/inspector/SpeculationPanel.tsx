"use client";

import { KeyValueGrid } from "@/components/ui/KeyValueGrid";
import { MetricCell } from "@/components/ui/MetricCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatScore } from "@/lib/format";
import type { TraceRecord } from "@/types/trace";

const REASON_LABEL: Record<string, string> = {
  one_reading: "the decomposer found one reading, close enough to reuse",
  rephrased: "the decomposer found one reading, but it drifted too far to reuse",
  several_readings: "the decomposer found more than one reading",
  failed: "the speculative answer failed to complete",
};

/** Whether the answer that started forming before the utterance ended was kept (P7-F13). Explicitly "not recorded" when the field is absent — most turns never speculate at all. */
export function SpeculationPanel({ record }: { record: TraceRecord }) {
  const speculation = record.speculation;
  if (!speculation) {
    return (
      <EmptyState title="Not recorded" level={4}>
        This turn&rsquo;s trace carries no speculation record — either nothing was speculated, or the trace predates this field.
      </EmptyState>
    );
  }

  return (
    <KeyValueGrid label="Speculation">
      <MetricCell label="Outcome" value={speculation.kept ? "Kept" : "Dropped"} tone={speculation.kept ? "ok" : "default"} provenance="measured" />
      <MetricCell label="Reused search" value={speculation.reused} provenance="measured" />
      <MetricCell label="Cosine similarity" value={speculation.cos === null ? null : formatScore(speculation.cos)} provenance={speculation.cos === null ? "unavailable" : "measured"} />
      <MetricCell label="Reason" value={REASON_LABEL[speculation.reason] ?? speculation.reason} provenance="measured" />
    </KeyValueGrid>
  );
}
