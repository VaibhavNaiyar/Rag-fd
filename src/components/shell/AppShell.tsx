"use client";

import { Activity } from "lucide-react";
import { useEffect } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { ReplayBar } from "@/components/replay/ReplayBar";
import { ErrorBanner } from "@/components/shell/ErrorBanner";
import { Sidebar } from "@/components/shell/Sidebar";
import { LegacyTopBar } from "@/components/shell/LegacyTopBar";
import { ControllerTimeline } from "@/components/trace/ControllerTimeline";
import { MetricsBar } from "@/components/trace/MetricsBar";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { useClientValue } from "@/hooks/useClientValue";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { BREAKPOINT } from "@/lib/constants";
import { selectActiveTurn } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/** Below this width the sidebar stops being a grid column and becomes an overlay drawer. */
const SIDEBAR_COMPACT = `(max-width: ${BREAKPOINT.sidebar - 1}px)`;
/** Below this width there isn't room for a third, persistent trace column. */
const TRACE_COMPACT = `(max-width: ${BREAKPOINT.trace - 1}px)`;

/** Read from location rather than useSearchParams: a static export would
 *  otherwise need a Suspense boundary for a single boolean. */
function useReplayMode(): boolean {
  return useClientValue(
    () => new URLSearchParams(window.location.search).get("replay") === "1",
    false,
  );
}

/**
 * The persistent trace pane.
 *
 * A dashboard-style at-a-glance layer that sits alongside the conversation —
 * not a replacement for the full step-by-step breakdown, which still renders
 * inline above each turn's answer (ActivityLog). It reads the same
 * `selectActiveTurn` the trace rail has always used, so nothing about the
 * AG-UI event pipeline or the store changes to support it: this is strictly a
 * new way of arranging pieces that already exist.
 */
function TracePanel() {
  const activeTurn = useAppStore(selectActiveTurn);
  if (!activeTurn) return null;

  return (
    <aside
      aria-label="Trace"
      className="flex h-full min-w-0 [grid-column:3] flex-col overflow-hidden border-l border-line bg-surface"
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3.5 py-3">
        <Activity size={14} aria-hidden className="shrink-0 text-ink-muted" />
        <h2 className="text-label font-semibold text-ink">Trace</h2>
        <span className="ml-auto shrink-0 font-mono text-caption tabular text-ink-muted">
          {activeTurn.status}
        </span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3.5">
        {activeTurn.transcript.length === 0 ? (
          <EmptyHint>Trace for the active turn appears here once it starts.</EmptyHint>
        ) : (
          <div className="space-y-4">
            <section className="rounded-md border border-line bg-raised p-3">
              <h3 className="mb-2 text-caption font-medium uppercase tracking-wide text-ink-muted">
                Retrieval timeline
              </h3>
              <ControllerTimeline turn={activeTurn} />
            </section>
            <section className="rounded-md border border-line bg-raised p-3">
              <h3 className="mb-2 text-caption font-medium uppercase tracking-wide text-ink-muted">
                Telemetry
              </h3>
              <MetricsBar turn={activeTurn} />
            </section>
            <p className="break-words text-caption text-ink-muted">
              Full step-by-step detail — evidence, sub-queries, the version diff — stays inline with
              the answer below.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function AppShell() {
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const newSession = useAppStore((state) => state.newSession);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const phase = useAppStore((state) => state.phase);

  const replayMode = useReplayMode();
  const sidebarIsDrawer = useMediaQuery(SIDEBAR_COMPACT);
  const traceIsCompact = useMediaQuery(TRACE_COMPACT);
  const showTrace = phase !== "idle" && !traceIsCompact;
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // sidebarOpen defaults to true app-wide (correct for the always-visible desktop
  // column), but that same default meant a mobile drawer opened over the whole
  // screen on first load, with no visible hint there was a chat behind it — a
  // real bug DevTools would show as "the layout doesn't adapt at 375px." This
  // only fires when the layout MODE changes (drawer vs. column), so it sets a
  // sensible default per mode without ever fighting a manual toggle within one.
  useEffect(() => {
    toggleSidebar(!sidebarIsDrawer);
  }, [sidebarIsDrawer, toggleSidebar]);

  useHotkeys([
    { key: "k", mod: true, allowInInput: true, handler: newSession },
    { key: "escape", allowInInput: true, handler: stopStreaming },
  ]);

  return (
    <div
      className="app-shell bg-canvas"
      data-sidebar={sidebarOpen ? "open" : "closed"}
      data-trace={showTrace ? "open" : "closed"}
    >
      {/*
       * Every direct child pins its own grid-column explicitly rather than
       * relying on auto-placement. Real bug this fixes: when the sidebar
       * becomes `fixed` (drawer mode below), it's removed from the grid's
       * normal flow — auto-placement then shoves the NEXT in-flow child (this
       * middle column) into the now-vacant column 1, which is 0px wide in
       * drawer mode. The chat column silently collapsed to zero width on
       * every viewport below 768px. Verified live: before this, the composer
       * textarea measured 0px wide at 375px; after, it fills the column.
       */}
      <Sidebar
        className={cn(
          "[grid-column:1]",
          sidebarIsDrawer &&
            cn(
              "fixed inset-y-0 left-0 z-30 w-[260px] shadow-lift transition-transform duration-[280ms] ease-oneui",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
            ),
        )}
      />

      <div className="flex min-w-0 [grid-column:2] flex-col">
        <LegacyTopBar />
        {replayMode && <ReplayBar />}
        <ErrorBanner />
        <div className="min-h-0 flex-1">
          <ChatPane />
        </div>
      </div>

      {showTrace && <TracePanel />}
    </div>
  );
}
