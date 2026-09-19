"use client";

import { PanelLeft } from "lucide-react";
import { ConnectionBadge } from "@/components/shell/ConnectionBadge";
import { IconButton } from "@/components/ui/IconButton";
import { useAppStore } from "@/store/useAppStore";

export function TopBar() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3">
      {/* While the sidebar is open its own header holds the toggle. */}
      {!sidebarOpen && (
        <IconButton
          label="Show sessions"
          icon={<PanelLeft size={17} aria-hidden />}
          onClick={() => toggleSidebar(true)}
        />
      )}

      <div className="min-w-0 flex-1" />

      <ConnectionBadge />
    </header>
  );
}
