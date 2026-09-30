"use client";

import { ArrowDown } from "lucide-react";
import { Composer } from "@/components/console/Composer";
import { EmptyConsole } from "@/components/console/EmptyConsole";
import { ReplayControls } from "@/components/console/ReplayControls";
import { TurnLedger } from "@/components/console/TurnLedger";
import { Button } from "@/components/ui/Button";
import { useReplayMode } from "@/hooks/useReplayMode";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { selectSessionTurns } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";
import type { Turn } from "@/store/types";

/** A rendering key that changes whenever anything visible in the ledger changes, so the scroll anchor re-checks at the right moments without re-running on every unrelated store update. */
function streamSignature(turns: Turn[]): string {
  const last = turns[turns.length - 1];
  if (!last) return "0";
  const body = last.versions.reduce((total, version) => total + version.body.length, 0);
  return `${turns.length}:${last.transcript.length}:${body}:${last.status}`;
}

/**
 * The conversation as an instrument (P6-F01, cuts over in P6-F16). Empty state,
 * the turn ledger, the composer. `main` is the frame's own landmark
 * (`Workbench.tsx`) — this is its content, not a second one.
 */
export function ConsoleView() {
  const turns = useAppStore(selectSessionTurns);
  const replayMode = useReplayMode();
  const { ref, isPinned, scrollToBottom } = useStickToBottom<HTMLDivElement>(streamSignature(turns));

  return (
    <div className="flex h-full min-w-0 flex-col">
      {replayMode && <ReplayControls />}

      <div className="relative min-h-0 flex-1">
        <div ref={ref} className="scroll-thin h-full overflow-y-auto px-4 pb-4 pt-6">
          <div className="mx-auto min-w-0 max-w-3xl">{turns.length === 0 ? <EmptyConsole /> : <TurnLedger />}</div>
        </div>

        {!isPinned && turns.length > 0 && (
          <Button variant="secondary" size="sm" onClick={scrollToBottom} className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-float">
            <ArrowDown size={13} aria-hidden />
            Jump to latest
          </Button>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4">
        <Composer />
      </div>
    </div>
  );
}
