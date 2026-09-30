"use client";

import { Composer } from "@/components/chat/Composer";
import { Greeting } from "@/components/chat/Greeting";
import { MessageList } from "@/components/chat/MessageList";
import { TranscriptStrip } from "@/components/chat/TranscriptStrip";
import { ReplayBar } from "@/components/replay/ReplayBar";
import { SessionRollup } from "@/components/trace/SessionRollup";
import { ControllerTimeline } from "@/components/trace/ControllerTimeline";
import { MetricsBar } from "@/components/trace/MetricsBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { useReplayMode } from "@/hooks/useReplayMode";
import { cn } from "@/lib/cn";
import { selectActiveTurn } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/*
 * THE TEMPORARY BRIDGE (PHASES.md P4-F13). The new frame hosts the previous views'
 * content so that navigation, the Inspector and every viewport can be proved before the
 * views are rewritten. Each of these is replaced by its real view: the console in P6, the
 * Inspector in P7, the traces table in P8, metrics in P9. None of it is new design.
 */

/**
 * The previous chat column: greeting or messages, the transcript strip, the composer. Not a
 * landmark: the frame's <main> is. While there are no turns the greeting, and the composer
 * under it, are centred with `my-auto` inside a column that scrolls, not with
 * `justify-center`, which would push the top of a taller-than-the-screen greeting out of
 * reach on a phone.
 */
export function LegacyConsoleView() {
  const phase = useAppStore((state) => state.phase);
  const isListening = useAppStore((state) => state.isListening);
  const replayMode = useReplayMode();
  const idle = phase === "idle";

  return (
    <div className="flex h-full min-w-0 flex-col">
      {replayMode && <ReplayBar />}
      <div className={cn("mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col px-4", idle ? "overflow-y-auto" : "justify-end")}>
        <div className={cn("flex min-h-0 min-w-0 flex-col", idle ? "my-auto" : "flex-1 justify-end")}>
          {idle ? <Greeting /> : <MessageList />}
          {isListening && <TranscriptStrip />}
          <Composer />
        </div>
      </div>
    </div>
  );
}

/** The previous trace panel, for the newest turn: the retrieval timeline and the telemetry. */
export function LegacyInspectorView() {
  const turn = useAppStore(selectActiveTurn);

  if (!turn) {
    return (
      <div className="p-3">
        <EmptyState title="No turn yet">Ask a question or replay a test case. The trace of the newest turn appears here.</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 p-3">
      <p className="m-0 text-caption text-ink-muted">
        Turn <span className="font-mono text-ink-body">{turn.id}</span>, {turn.status}
      </p>
      {turn.transcript.length === 0 ? (
        <EmptyState title="Waiting for the turn">The trace appears once the turn starts.</EmptyState>
      ) : (
        <>
          <Panel title="Retrieval timeline" level={3}>
            <ControllerTimeline turn={turn} />
          </Panel>
          <Panel title="Telemetry" level={3}>
            <MetricsBar turn={turn} />
          </Panel>
        </>
      )}
    </div>
  );
}

/** The traces table is built in P8. Until then, say so, and say where each turn's trace is. */
export function TracesPlaceholder() {
  return (
    <div className="mx-auto max-w-console p-gutter">
      <EmptyState title="Traces" level={2}>
        The table of turns is not built yet. The trace of a turn is in the Inspector: open it from the bar above.
      </EmptyState>
    </div>
  );
}

/** The previous session rollup, until the metrics view is built (P9). */
export function LegacyMetricsView() {
  const turns = useAppStore((state) => state.turns.length);

  return (
    <div className="mx-auto max-w-console p-gutter">
      {turns === 0 ? (
        <EmptyState title="Metrics" level={2}>
          Nothing to summarise yet. Ask a question or replay a test case, and the figures for the session appear here.
        </EmptyState>
      ) : (
        <Panel title="Session telemetry" level={2}>
          <SessionRollup />
        </Panel>
      )}
    </div>
  );
}
