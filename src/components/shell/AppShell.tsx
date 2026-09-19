"use client";

import { useEffect } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { ReplayBar } from "@/components/replay/ReplayBar";
import { ErrorBanner } from "@/components/shell/ErrorBanner";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { useClientValue } from "@/hooks/useClientValue";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { BREAKPOINT } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

/** Below this width the sidebar stops being a grid column and becomes an overlay drawer. */
const SIDEBAR_COMPACT = `(max-width: ${BREAKPOINT.sidebar - 1}px)`;

/** Read from location rather than useSearchParams: a static export would
 *  otherwise need a Suspense boundary for a single boolean. */
function useReplayMode(): boolean {
  return useClientValue(
    () => new URLSearchParams(window.location.search).get("replay") === "1",
    false,
  );
}

export function AppShell() {
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const newSession = useAppStore((state) => state.newSession);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  const replayMode = useReplayMode();
  const sidebarIsDrawer = useMediaQuery(SIDEBAR_COMPACT);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  useHotkeys([
    { key: "k", mod: true, allowInInput: true, handler: newSession },
    { key: "escape", allowInInput: true, handler: stopStreaming },
  ]);

  return (
    <div
      className="app-shell bg-canvas"
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
        {replayMode && <ReplayBar />}
        <ErrorBanner />
        <div className="min-h-0 flex-1">
          <ChatPane />
        </div>
      </div>
    </div>
  );
}
