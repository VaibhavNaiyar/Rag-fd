"use client";

import { EmptyHint } from "@/components/ui/EmptyHint";
import { Pill } from "@/components/ui/Pill";
import { SOURCE_LABELS } from "@/lib/decisions";
import { formatCount } from "@/lib/format";
import type { Turn } from "@/store/types";

/**
 * The gate-3 visual: one sentence, visibly split into N search-ready questions.
 *
 * Chips stagger in as the decomposer publishes them, and each carries the number
 * of candidates its branch actually scored — over-fragmenting a simple question
 * is one of the named pitfalls, so the counts are what make the split defensible.
 */
export function SubQueryList({ turn }: { turn: Turn }) {
  if (turn.subQueries.length === 0) {
    return <EmptyHint>No decomposition yet — the controller has not committed to a search.</EmptyHint>;
  }

  return (
    <ol className="space-y-2">
      {turn.subQueries.map((sub, index) => (
        <li
          key={sub.id}
          className="animate-rise-in rounded-md border border-line bg-raised px-3 py-2"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className="flex items-start gap-2">
            <span className="mt-px shrink-0 font-mono text-caption tabular text-ink-muted">
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 text-caption leading-[18px] text-ink-body">
              {sub.text || <span className="text-ink-muted">awaiting text…</span>}
            </p>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
            <Pill tone={sub.source === "decomposed" ? "primary" : "neutral"}>
              {SOURCE_LABELS[sub.source]}
            </Pill>
            {sub.candidates !== undefined && (
              <span className="font-mono text-caption tabular text-ink-muted">
                {formatCount(sub.candidates)} scored → {formatCount(sub.keptCount ?? 0)} kept
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
