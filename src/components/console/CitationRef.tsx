"use client";

import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import type { Hit } from "@/types/events";

export interface CitationRefProps {
  marker: string;
  /** Null when no retrieved chunk carries this citation — the fabricated-citation case, which must be impossible to miss. */
  hit: Hit | null;
}

/**
 * An inline `[n]` citation marker (P6-F08, replaces `CitationChip`). Opens a
 * Popover with the source, its score and the quoted text on click, and marks
 * `hoveredChunkId` on hover/focus so the Inspector's evidence rows can light up
 * the same chunk — a marker with no matching hit still hovers (there is nothing
 * to look up), it just cannot open a source.
 */
export function CitationRef({ marker, hit }: CitationRefProps) {
  const hoveredChunkId = useAppStore((state) => state.hoveredChunkId);
  const setHoveredChunk = useAppStore((state) => state.setHoveredChunk);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  if (!hit) {
    return (
      <span className="mx-0.5 inline-flex items-center gap-1 rounded-1 border border-error-edge bg-error-soft px-1.5 py-px align-baseline font-mono text-caption text-error">
        <AlertTriangle size={11} aria-hidden />
        {marker}
        <span className="sr-only"> (unverified citation — no retrieved chunk carries this marker)</span>
      </span>
    );
  }

  const isActive = hoveredChunkId === hit.chunkId;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={() => setHoveredChunk(hit.chunkId)}
        onMouseLeave={() => setHoveredChunk(null)}
        onFocus={() => setHoveredChunk(hit.chunkId)}
        onBlur={() => setHoveredChunk(null)}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "mx-0.5 inline-flex items-baseline rounded-1 border px-1.5 py-px align-baseline",
          "font-mono text-caption transition-colors duration-1 ease-standard",
          isActive || open ? "border-accent bg-accent text-on-accent" : "border-accent-edge bg-accent-soft text-accent-ink hover:border-accent",
        )}
      >
        {marker}
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchorRef} label={`Source for citation ${marker}`} maxWidth={320}>
        <div className="min-w-0 max-w-80 space-y-1.5 p-3">
          <p className="min-w-0 break-words font-mono text-caption text-ink">
            {hit.docId} §{hit.section}
          </p>
          <p className="text-caption text-ink-muted">score {formatScore(hit.score)} · {hit.branches.join(", ")}</p>
          <blockquote className="min-w-0 break-words border-l-2 border-line pl-2 text-caption text-ink-body">{hit.text}</blockquote>
        </div>
      </Popover>
    </>
  );
}
