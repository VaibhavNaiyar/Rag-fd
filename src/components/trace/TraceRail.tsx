"use client";

import { X } from "lucide-react";
import { ControllerTimeline } from "@/components/trace/ControllerTimeline";
import { EvidenceList } from "@/components/trace/EvidenceList";
import { MetricsBar } from "@/components/trace/MetricsBar";
import { SessionRollup } from "@/components/trace/SessionRollup";
import { SubQueryList } from "@/components/trace/SubQueryList";
import { VersionDiff } from "@/components/trace/VersionDiff";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { IconButton } from "@/components/ui/IconButton";
import { TraceSection } from "@/components/ui/TraceSection";
import { cn } from "@/lib/cn";
import { selectActiveTurn } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * The trace rail.
 *
 * Section order is deliberate and matches the pipeline: what the controller
 * decided, what it decided to ask, what came back, what the answer did with it,
 * and what it cost. `aria-live="off"` throughout — a screen reader should not be
 * flooded by a stream of retrieval events.
 */
export function TraceRail({ className, onClose }: { className?: string; onClose?: () => void }) {
  const turn = useAppStore(selectActiveTurn);

  return (
    <aside
      aria-label="Pipeline trace"
      aria-live="off"
      className={cn("flex h-full min-w-0 flex-col overflow-hidden border-l border-line bg-surface", className)}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="min-w-0 flex-1 truncate text-label font-semibold text-ink">Pipeline trace</h2>
        {turn && (
          <span className="shrink-0 font-mono text-caption text-ink-muted">{turn.id}</span>
        )}
        {onClose && (
          <IconButton size="sm" label="Close trace" icon={<X size={15} aria-hidden />} onClick={onClose} />
        )}
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {!turn ? (
          <div className="p-4">
            <EmptyHint>
              Send a request, or replay a fixture, and every controller decision lands here as it
              happens.
            </EmptyHint>
          </div>
        ) : (
          <>
            <TraceSection title="Controller" meta={`${turn.decisions.length}`}>
              <ControllerTimeline turn={turn} />
            </TraceSection>

            <TraceSection title="Sub-queries" meta={`${turn.subQueries.length}`}>
              <SubQueryList turn={turn} />
            </TraceSection>

            <TraceSection title="Evidence" meta={`${turn.evidence.length}`}>
              <EvidenceList turn={turn} />
            </TraceSection>

            <TraceSection
              title="Answer versions"
              meta={turn.versions.length > 1 ? `v1 → v${turn.versions.length}` : `v${turn.versions.length || 1}`}
            >
              <VersionDiff turn={turn} />
            </TraceSection>

            <TraceSection title="Telemetry — this turn">
              <MetricsBar turn={turn} />
            </TraceSection>

            <TraceSection title="Telemetry — session" defaultOpen={false}>
              <SessionRollup />
            </TraceSection>
          </>
        )}
      </div>
    </aside>
  );
}
