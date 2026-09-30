"use client";

import { useEffect } from "react";
import { ConsoleView } from "@/components/console/ConsoleView";
import { InspectorPane } from "@/components/inspector/InspectorPane";
import { ConnectionAlert } from "@/components/shell/ConnectionState";
import { LegacyMetricsView, TracesPlaceholder } from "@/components/shell/LegacyBridge";
import { NavRail } from "@/components/shell/NavRail";
import { StatusStrip } from "@/components/shell/StatusStrip";
import { TabBar } from "@/components/shell/TabBar";
import { TopBar } from "@/components/shell/TopBar";
import { Workbench } from "@/components/shell/Workbench";
import { SkipLink } from "@/components/ui/a11y";
import { ToastProvider } from "@/components/ui/Toast";
import { useActiveView } from "@/hooks/useActiveView";
import { useAtLeast } from "@/hooks/useBreakpoint";
import { useEngineHealth } from "@/hooks/useEngineHealth";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useReplayMode } from "@/hooks/useReplayMode";
import { viewRoute, type View } from "@/lib/route";
import { useAppStore } from "@/store/useAppStore";

function ViewHost({ view }: { view: View }) {
  switch (view) {
    case "console":
      return <ConsoleView />;
    case "traces":
      return <TracesPlaceholder />;
    case "metrics":
      return <LegacyMetricsView />;
  }
}

/**
 * The application frame (PHASES.md §3.5): a skip link, the navy top bar, the views (a nav
 * rail from 768 px, a tab bar below), the workbench with its Inspector, a status strip from
 * 768 px, and the root every floating layer renders into. There is one `main`.
 *
 * It owns the connection: it opens the engine stream when it mounts and closes it when it
 * goes. It carries `data-connection`, so a test can wait for the stream to be live.
 * Console (P6) and the Inspector (P7) are real; Traces and Metrics are still the
 * previous content, through the bridge (LegacyBridge.tsx), until P8–P9 replace them.
 */
export function AppFrame() {
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const newSession = useAppStore((state) => state.newSession);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const connection = useAppStore((state) => state.connection);
  const sessionId = useAppStore((state) => state.shared?.session?.id ?? "live");
  const newestTurnId = useAppStore((state) => state.turns[state.turns.length - 1]?.id ?? "latest");

  const replayMode = useReplayMode();
  const { health } = useEngineHealth({ enabled: !replayMode });
  const { route, navigate } = useHashRoute();
  const view = useActiveView(route);
  const docked = useAtLeast("lg");
  const inspectorOpen = route.kind === "inspect";

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Escape closes a floating layer first (layerStack.ts stops the key); only when none is open does it reach here.
  useHotkeys([
    { key: "k", mod: true, allowInInput: true, handler: newSession },
    { key: "escape", allowInInput: true, handler: stopStreaming },
  ]);

  const toggleInspector = () => navigate(inspectorOpen ? viewRoute(view) : { kind: "inspect", sessionId, turnId: newestTurnId, tab: null });

  return (
    <ToastProvider>
      <div className="frame" data-shell="frame" data-connection={connection}>
        <SkipLink targetId="main" />
        <TopBar health={health} inspectorOpen={inspectorOpen} onToggleInspector={toggleInspector} />
        <NavRail active={view} />
        <div className="frame-main">
          <Workbench
            docked={docked}
            inspectorOpen={inspectorOpen}
            onCloseInspector={() => navigate(viewRoute(view))}
            inspectorTitle={route.kind === "inspect" ? `Turn ${route.turnId}` : "Inspector"}
            inspector={<InspectorPane sessionId={route.kind === "inspect" ? route.sessionId : sessionId} turnId={route.kind === "inspect" ? route.turnId : newestTurnId} />}
          >
            <ConnectionAlert className="m-gutter mb-0" />
            <ViewHost view={view} />
          </Workbench>
        </div>
        <TabBar active={view} />
        <StatusStrip health={health} />
      </div>
      <div id="layer-root" />
    </ToastProvider>
  );
}
