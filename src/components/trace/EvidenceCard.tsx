"use client";

import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import type { Hit } from "@/types/events";

const BRANCH_LABELS: Record<string, string> = { bm25: "BM25", dense: "Dense" };

/**
 * One retrieved chunk.
 *
 * Hovering it highlights every citation chip in the answer that cites it, and
 * hovering a chip lifts this card — the bidirectional link is what makes
 * "grounded" feel true rather than asserted.
 */
export function EvidenceCard({ hit, index }: { hit: Hit; index: number }) {
  const hoveredChunkId = useAppStore((state) => state.hoveredChunkId);
  const setHoveredChunk = useAppStore((state) => state.setHoveredChunk);
  const isActive = hoveredChunkId === hit.chunkId;

  return (
    <li
      onMouseEnter={() => setHoveredChunk(hit.chunkId)}
      onMouseLeave={() => setHoveredChunk(null)}
      style={{ animationDelay: `${index * 30}ms` }}
      className={cn(
        "animate-rise-in rounded-md border bg-raised px-3 py-2.5",
        "transition-[border-color,box-shadow,transform] duration-150 ease-oneui",
        isActive
          ? "-translate-y-px border-primary shadow-lift"
          : "border-line hover:border-[var(--border-strong)]",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate font-mono text-caption font-medium text-ink">
          {hit.docId} §{hit.section}
        </span>
        <span className="ml-auto shrink-0 font-mono text-caption tabular text-ink-muted">
          {formatScore(hit.score)}
        </span>
      </div>

      <p className="mt-1 line-clamp-4 text-caption leading-[18px] text-ink-body">{hit.text}</p>

      <div className="mt-1.5 flex items-center gap-1.5">
        {hit.branches.map((branch) => (
          <span
            key={branch}
            className="rounded-sm border border-line px-1.5 py-px font-mono text-[10px] text-ink-muted"
          >
            {BRANCH_LABELS[branch] ?? branch}
          </span>
        ))}
        <span className="ml-auto truncate font-mono text-[10px] text-ink-muted">{hit.chunkId}</span>
      </div>
    </li>
  );
}
