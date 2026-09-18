"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { ConnectionBadge } from "@/components/shell/ConnectionBadge";
import { IconButton } from "@/components/ui/IconButton";
import { useAppStore } from "@/store/useAppStore";

export function TopBar() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const traceOpen = useAppStore((state) => state.traceOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const toggleTrace = useAppStore((state) => state.toggleTrace);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3">
      <IconButton
        label={sidebarOpen ? "Hide sessions" : "Show sessions"}
        icon={<PanelLeft size={17} aria-hidden />}
        active={sidebarOpen}
        onClick={() => toggleSidebar()}
      />

      <div className="min-w-0 flex-1" />

      <ConnectionBadge />

      <IconButton
        label={traceOpen ? "Hide trace rail (⌘/)" : "Show trace rail (⌘/)"}
        icon={<PanelRight size={17} aria-hidden />}
        active={traceOpen}
        onClick={() => toggleTrace()}
      />
    </header>
  );
}
