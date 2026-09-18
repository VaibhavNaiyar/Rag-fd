"use client";

import { AudioLines } from "lucide-react";
import { DecisionPill } from "@/components/ui/DecisionPill";
import { latestDecision, selectActiveTurn } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * The LISTENING state: words arriving, with the controller's live verdict.
 *
 * The text comes from the local draft rather than the echoed transcript so it
 * appears the instant a chunk is emitted — the decision pill beside it is the
 * engine's, and the gap between the two is exactly the round trip being shown.
 */
export function TranscriptStrip() {
  const draft = useAppStore((state) => state.draftTranscript);
  const activeTurn = useAppStore(selectActiveTurn);

  const decision = activeTurn ? latestDecision(activeTurn) : null;

  return (
    <div className="mb-2 animate-rise-in rounded-md border border-line bg-sunken px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <AudioLines size={14} aria-hidden className="shrink-0 animate-pulse text-primary-ink" />
        <span className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Listening
        </span>
        <span className="ml-auto">
          {decision ? (
            <DecisionPill
              decision={decision.decision}
              reason={decision.reason}
              {...(decision.confidence === undefined ? {} : { confidence: decision.confidence })}
            />
          ) : (
            <span className="text-caption text-ink-muted">awaiting first decision…</span>
          )}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-body text-ink-body">
        {draft || <span className="text-ink-muted">…</span>}
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
      </p>
    </div>
  );
}
