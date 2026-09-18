"use client";

import { useMemo } from "react";
import { Stat } from "@/components/ui/Stat";
import { formatCount, formatLead, formatMs, formatRate, formatUsd } from "@/lib/format";
import { selectSessionMetrics } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * Session-wide telemetry.
 *
 * The per-turn numbers prove one turn; these are the numbers that go in the deck
 * — early-retrieval rate against G2's 80% threshold, mean support against G4's
 * 85%, and the running cost. Memoised on the turns array rather than read as a
 * store selector, because the rollup is a fresh object on every call.
 */
export function SessionRollup() {
  const turns = useAppStore((state) => state.turns);
  const metrics = useMemo(() => selectSessionMetrics(turns), [turns]);

  if (metrics.turns === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat
        label="Early retrieval"
        value={formatRate(metrics.earlyRetrievalRate)}
        hint="G2 target ≥ 80%"
        tone={
          metrics.earlyRetrievalRate !== null && metrics.earlyRetrievalRate >= 0.8 ? "ok" : "warn"
        }
      />
      <Stat label="Mean lead" value={formatLead(metrics.meanLeadMs)} hint="before utterance end" />
      <Stat
        label="Citation support"
        value={formatRate(metrics.meanSupportRate)}
        hint="G4 target ≥ 85%"
        tone={metrics.meanSupportRate !== null && metrics.meanSupportRate >= 0.85 ? "ok" : "warn"}
      />
      <Stat label="Mean TTFT" value={formatMs(metrics.meanTtftMs)} hint="from utterance end" />
      <Stat
        label="Session cost"
        value={formatUsd(metrics.totalUsd)}
        hint={`${formatCount(metrics.totalTokens)} tokens`}
      />
      <Stat
        label="Fabricated"
        value={formatCount(metrics.fabricatedCitations)}
        hint="citations with no chunk"
        tone={metrics.fabricatedCitations === 0 ? "ok" : "error"}
      />
    </div>
  );
}
