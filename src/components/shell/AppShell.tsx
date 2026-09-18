"use client";

import { useEffect } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { DemoBar } from "@/components/demo/DemoBar";
import { ErrorBanner } from "@/components/shell/ErrorBanner";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { TraceRail } from "@/components/trace/TraceRail";
import { useClientValue } from "@/hooks/useClientValue";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { BREAKPOINT } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

/** Panels below these widths stop being grid columns and become overlay drawers. */
const TRACE_COMPACT = `(max-width: ${BREAKPOINT.trace - 1}px)`;
const SIDEBAR_COMPACT = `(max-width: ${BREAKPOINT.sidebar - 1}px)`;

/** Read from location rather than useSearchParams: a static export would
 *  otherwise need a Suspense boundary for a single boolean. */
function useDemoMode(): boolean {
  return useClientValue(
    () => new URLSearchParams(window.location.search).get("demo") === "1",
    false,
  );
}

export function AppShell() {
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const newSession = useAppStore((state) => state.newSession);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const toggleTrace = useAppStore((state) => state.toggleTrace);
  const traceOpen = useAppStore((state) => state.traceOpen);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  const demoMode = useDemoMode();
  const traceIsDrawer = useMediaQuery(TRACE_COMPACT);
  const sidebarIsDrawer = useMediaQuery(SIDEBAR_COMPACT);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  useHotkeys([
    { key: "k", mod: true, allowInInput: true, handler: newSession },
    { key: "/", mod: true, allowInInput: true, handler: () => toggleTrace() },
    { key: "escape", allowInInput: true, handler: stopStreaming },
  ]);

  return (
    <div
      className="app-shell bg-canvas"
      data-trace={traceOpen ? "open" : "closed"}
      data-sidebar={sidebarOpen ? "open" : "closed"}
    >
      <Sidebar
        className={cn(
          sidebarIsDrawer &&
            cn(
              "fixed inset-y-0 left-0 z-30 w-[260px] shadow-lift transition-transform duration-[280ms] ease-oneui",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
            ),
        )}
      />

      <div className="flex min-w-0 flex-col">
        <TopBar />
        {demoMode && <DemoBar />}
        <ErrorBanner />
        <div className="min-h-0 flex-1">
          <ChatPane />
        </div>
      </div>

      {traceIsDrawer ? (
        <>
          {traceOpen && (
            <button
              type="button"
              aria-label="Close trace"
              onClick={() => toggleTrace(false)}
              className="fixed inset-0 z-20 bg-[var(--scrim)]"
            />
          )}
          <TraceRail
            onClose={() => toggleTrace(false)}
            className={cn(
              "fixed inset-y-0 right-0 z-30 w-[380px] max-w-[92vw] shadow-lift",
              "transition-transform duration-[280ms] ease-oneui",
              traceOpen ? "translate-x-0" : "translate-x-full",
            )}
          />
        </>
      ) : (
        <TraceRail />
      )}
    </div>
  );
}
