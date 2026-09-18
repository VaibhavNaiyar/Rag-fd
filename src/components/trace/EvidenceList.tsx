"use client";

import { EvidenceCard } from "@/components/trace/EvidenceCard";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { Pill } from "@/components/ui/Pill";
import { formatCount, truncate } from "@/lib/format";
import { groupEvidence } from "@/store/selectors";
import type { Turn } from "@/store/types";

/**
 * Fused evidence, grouped by the sub-query that found it.
 *
 * The quota badge is the visible half of the fusion guarantee: no single intent
 * can crowd the others out of the context window.
 */
export function EvidenceList({ turn }: { turn: Turn }) {
  const groups = groupEvidence(turn);

  if (groups.length === 0) {
    return <EmptyHint>No chunks retrieved for this turn.</EmptyHint>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill mono>{formatCount(turn.evidence.length)} chunks fused</Pill>
        {turn.quotaApplied && (
          <Pill tone="primary" title="A per-sub-query quota capped how much any one intent could contribute">
            per-sub-query quota
          </Pill>
        )}
        {!turn.fullCorpusSearch && (
          <Pill tone="ok" title="This turn reused session state instead of re-searching the corpus">
            no full-corpus search
          </Pill>
        )}
      </div>

      {groups.map((group) => (
        <div key={group.subQueryId}>
          <h4 className="mb-1.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 text-caption font-medium text-ink-muted">
              {truncate(group.label, 70)}
            </span>
            <span className="shrink-0 font-mono text-caption tabular text-ink-muted">
              {group.hits.length}
            </span>
          </h4>
          <ul className="space-y-2">
            {group.hits.map((hit, index) => (
              <EvidenceCard key={hit.chunkId} hit={hit} index={index} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
