"use client";

import { Stat } from "@/components/ui/Stat";
import { EMPTY, formatLead, formatMs, formatRate, formatUsd } from "@/lib/format";
import { latestVersion, retrievalLeadMs } from "@/store/selectors";
import type { Turn } from "@/store/types";

/**
 * The gate-6 readout for one turn.
 *
 * Every number the theme asks to be reported — retrieval lead, time to first
 * token, cost per turn, citation support — in one place, updating live.
 */
export function MetricsBar({ turn }: { turn: Turn }) {
  const lead = retrievalLeadMs(turn);
  const version = latestVersion(turn);
  const suppressed = turn.retrievals.length === 0 && turn.utteranceEndMs !== null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Retrieval lead"
          value={lead === null ? EMPTY : formatLead(lead)}
          hint={
            lead === null
              ? suppressed
                ? "suppressed, no search"
                : "awaiting utterance end"
              : lead > 0
                ? "before utterance end"
                : "after utterance end"
          }
          tone={lead !== null && lead > 0 ? "primary" : "default"}
        />
        <Stat
          label="Time to first token"
          value={formatMs(turn.latencyMs?.firstToken)}
          hint="from utterance end"
        />
        <Stat
          label="Cost / turn"
          value={formatUsd(turn.cost?.turnUsd)}
          hint={turn.cost ? `${turn.cost.turnTokens.toLocaleString("en-US")} tokens` : undefined}
        />
        <Stat
          label="Citation support"
          value={formatRate(version?.citationSupportRate)}
          tone={
            version === null || version === undefined
              ? "default"
              : version.citationSupportRate >= 0.85
                ? "ok"
                : "warn"
          }
          hint={
            version && version.fabricatedCitations > 0
              ? `${version.fabricatedCitations} fabricated`
              : "0 fabricated"
          }
        />
      </div>

      {turn.cost && turn.cost.steps.length > 0 && (
        <dl className="space-y-1 border-t border-line pt-2">
          {turn.cost.steps.map((step) => (
            <div key={step.step} className="flex items-baseline gap-2 text-caption">
              <dt className="min-w-0 flex-1 truncate text-ink-muted">{step.step}</dt>
              <dd className="shrink-0 font-mono tabular text-ink-body">{formatUsd(step.usd)}</dd>
            </div>
          ))}
        </dl>
      )}

      {turn.latencyMs && (
        <p className="text-caption text-ink-muted">
          Complete in {formatMs(turn.latencyMs.complete)} after the utterance ended.
        </p>
      )}
    </div>
  );
}
