"use client";

import { Square } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import { useAppStore } from "@/store/useAppStore";
import type { Turn, TurnStatus } from "@/store/types";

const PHASE_LABEL: Partial<Record<TurnStatus, string>> = {
  listening: "Listening",
  retrieving: "Retrieving",
  answering: "Synthesising",
};

/** Searches this turn launched that neither kept a result nor were cancelled yet. */
function searchesInFlight(turn: Turn): number {
  return turn.retrievals.filter((search) => {
    if (search.cancelledReason) return false;
    const stats = turn.subQueries.find((sub) => sub.id === search.subQueryId);
    return stats?.keptCount === undefined;
  }).length;
}

/** Live-phase status line (P6-F05, replaces the shimmering "thinking" text). No animation beyond this component's own elapsed timer — the phase label and glyph are static. */
export function LiveStrip({ turn }: { turn: Turn }) {
  const isListening = useAppStore((state) => state.isListening);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (turn.status === "complete" || turn.status === "error") return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsedMs(performance.now() - start), 250);
    return () => window.clearInterval(id);
  }, [turn.status]);

  const label = PHASE_LABEL[turn.status];
  if (!label) return null;

  const inFlight = searchesInFlight(turn);

  return (
    <div className="mb-2 flex min-h-hit items-center gap-2 rounded-2 border border-line bg-surface-2 px-3 py-1.5">
      <Spinner size="sm" label={label} />
      <span className="text-label font-medium text-ink">{label}</span>
      {inFlight > 0 && (
        <span className="font-mono text-caption text-ink-muted">
          {inFlight} search{inFlight === 1 ? "" : "es"} in flight
        </span>
      )}
      <span className="ml-auto font-mono text-caption tabular text-ink-muted">{(elapsedMs / 1000).toFixed(1)}s</span>
      {isListening && turn.status === "listening" && (
        <IconButton label="Stop streaming (Esc)" size="sm" icon={<Square size={12} aria-hidden fill="currentColor" />} onClick={stopStreaming} />
      )}
    </div>
  );
}
