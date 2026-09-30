"use client";

import { EllipsisVertical, Monitor, Moon, PanelRight, Sun } from "lucide-react";
import { useRef, useState } from "react";
import { ConnectionState } from "@/components/shell/ConnectionState";
import { StatusFacts } from "@/components/shell/StatusFacts";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Kbd } from "@/components/ui/Kbd";
import { Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Segmented";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import type { HealthResult } from "@/lib/health";
import { useAppStore } from "@/store/useAppStore";

const THEME_ICONS: Record<ThemePreference, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABELS: Record<ThemePreference, string> = { system: "Theme: follow system", light: "Theme: light", dark: "Theme: dark" };
const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export interface TopBarProps {
  health: HealthResult;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

/**
 * The navy bar across the top: 48 px (44 px on a phone), plus the notch. The product
 * name as text (no Samsung logotype), the connection to the engine, the Inspector
 * toggle, and, from 768 px, a new-session button and the theme toggle. Below 768 px
 * those two, and the facts the status strip shows on a wider screen, are in a menu, so
 * at 375 px the bar is a name and three icons.
 *
 * The new-session button is where the command palette will be (P11); until then it does
 * what Ctrl or Cmd K has always done, and says so.
 */
export function TopBar({ health, inspectorOpen, onToggleInspector }: TopBarProps) {
  const { theme, setTheme, cycleTheme } = useTheme();
  const newSession = useAppStore((state) => state.newSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header data-surface="chrome" className="frame-top bg-chrome pl-safe-left pr-safe-right pt-safe-top text-on-chrome">
      <div className="flex h-topbar min-w-0 items-center gap-2 border-b border-chrome-line px-gutter">
        <span className="min-w-0 truncate text-label font-semibold">Streaming Live RAG</span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ConnectionState surface="chrome" collapse className="mr-1" />
          <IconButton surface="chrome" label={inspectorOpen ? "Close inspector" : "Open inspector"} pressed={inspectorOpen} icon={<PanelRight size={18} />} onClick={onToggleInspector} />
          <Button
            variant="ghost"
            onClick={newSession}
            className="hidden border-chrome-line text-on-chrome enabled:hover:bg-chrome-hover enabled:active:bg-chrome-hover md:inline-flex"
            data-surface="chrome"
          >
            New session
            <Kbd surface="chrome" keys={["mod", "K"]} />
          </Button>
          <IconButton surface="chrome" label={THEME_LABELS[theme]} icon={<ThemeIcon size={18} />} onClick={cycleTheme} className="hidden md:inline-flex" />
          <IconButton
            ref={menuButton}
            surface="chrome"
            label="Menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            icon={<EllipsisVertical size={18} />}
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden"
          />
        </div>
      </div>

      <Popover open={menuOpen} onOpenChange={setMenuOpen} anchorRef={menuButton} label="Menu" align="end" className="w-80 max-w-full p-3">
        <div className="flex flex-col gap-4">
          <section aria-labelledby="menu-status">
            <h2 id="menu-status" className="mb-2 text-label font-semibold text-ink">
              Status
            </h2>
            <StatusFacts health={health} />
          </section>
          <section aria-labelledby="menu-theme">
            <h2 id="menu-theme" className="mb-2 text-label font-semibold text-ink">
              Theme
            </h2>
            <Segmented label="Theme" options={THEME_OPTIONS} value={theme === "system" ? "system" : theme} onValueChange={setTheme} />
          </section>
          <Button
            variant="secondary"
            onClick={() => {
              newSession();
              setMenuOpen(false);
            }}
          >
            New session
          </Button>
        </div>
      </Popover>
    </header>
  );
}
