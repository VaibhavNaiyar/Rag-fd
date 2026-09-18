"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";
import type { Hit } from "@/types/events";

export interface CitationChipProps {
  marker: string;
  /** null when no retrieved chunk carries this citation. */
  hit: Hit | null;
}

/**
 * An inline citation marker.
 *
 * Hovering sets `hoveredChunkId`, which lifts the matching evidence card in the
 * trace rail; the card does the same in reverse. A marker with no matching hit
 * renders in --error and says "unverified" — if the backend's validator works
 * this never appears, and if it ever does it must be impossible to miss rather
 * than quietly shipped.
 */
export function CitationChip({ marker, hit }: CitationChipProps) {
  const hoveredChunkId = useAppStore((state) => state.hoveredChunkId);
  const setHoveredChunk = useAppStore((state) => state.setHoveredChunk);

  if (!hit) {
    return (
      <span
        className="mx-0.5 inline-flex items-center gap-1 rounded-sm border border-edge-error bg-error-soft px-1.5 py-px align-baseline font-mono text-[11px] text-error"
        title="Unverified citation — no retrieved chunk carries this marker."
      >
        <AlertTriangle size={11} aria-hidden />
        {marker}
        <span className="sr-only"> (unverified citation)</span>
      </span>
    );
  }

  const isActive = hoveredChunkId === hit.chunkId;

  return (
    <button
      type="button"
      onMouseEnter={() => setHoveredChunk(hit.chunkId)}
      onMouseLeave={() => setHoveredChunk(null)}
      onFocus={() => setHoveredChunk(hit.chunkId)}
      onBlur={() => setHoveredChunk(null)}
      title={`${hit.docId} §${hit.section} — ${hit.chunkId}`}
      className={cn(
        "mx-0.5 inline-flex items-baseline rounded-sm border px-1.5 py-px align-baseline",
        "font-mono text-[11px] transition-colors duration-150 ease-oneui",
        isActive
          ? "border-primary bg-primary text-white"
          : "border-edge-primary bg-primary-soft text-primary-ink hover:border-primary",
      )}
    >
      {marker}
    </button>
  );
}
