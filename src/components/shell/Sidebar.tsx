"use client";

import { Activity, ChevronDown, Database, Monitor, Moon, PanelLeft, PenSquare, Sun } from "lucide-react";
import { SessionItem } from "@/components/shell/SessionItem";
import { SessionRollup } from "@/components/trace/SessionRollup";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";
import { formatCount, formatRelative } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const THEME_ICONS: Record<ThemePreference, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Theme: follow system",
  light: "Theme: light",
  dark: "Theme: dark",
};

export function Sidebar({ className }: { className?: string }) {
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const corpus = useAppStore((state) => state.corpus);
  const turnCount = useAppStore((state) => state.turns.length);
  const newSession = useAppStore((state) => state.newSession);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const { theme, cycleTheme } = useTheme();

  const ThemeIcon = THEME_ICONS[theme];

  return (
    <aside
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden border-r border-line bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden
            className="h-6 w-6 shrink-0 rounded-md"
            style={{ background: "var(--ai-glow)" }}
          />
          <span className="truncate text-label font-semibold text-ink">Streaming Live RAG</span>
        </div>
        {/* Closing lives with the thing it closes; reopening lives in the top bar. */}
        <IconButton
          size="sm"
          label="Hide sessions"
          icon={<PanelLeft size={16} aria-hidden />}
          onClick={() => toggleSidebar(false)}
        />
      </div>

      <div className="px-3 pb-3">
        <Button
          variant="outline"
          size="md"
          onClick={newSession}
          className="w-full justify-start px-3"
        >
          <PenSquare size={15} aria-hidden />
          New session
          <kbd className="ml-auto font-mono text-caption text-ink-muted">⌘K</kbd>
        </Button>
      </div>

      <nav aria-label="Sessions" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2">
        <h2 className="px-1.5 py-1.5 text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="px-1.5 py-2 text-caption text-ink-muted">
            Session memory only. Nothing is kept once the engine restarts.
          </p>
        ) : (
          <ul className="space-y-0.5 pb-2">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
              />
            ))}
          </ul>
        )}
      </nav>

      <footer className="border-t border-line px-3 py-3">
        {turnCount > 0 && (
          <details className="group/rollup mb-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <Activity size={13} aria-hidden />
              Session telemetry
              <ChevronDown size={13} aria-hidden className="ml-auto transition-transform group-open/rollup:rotate-180" />
            </summary>
            <div className="mt-2.5">
              <SessionRollup />
            </div>
          </details>
        )}
        <div className="mb-2 flex items-start gap-2">
          <Database size={14} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
          <div className="min-w-0 text-caption text-ink-muted">
            {corpus ? (
              <>
                <div className="font-mono tabular text-ink-body">
                  {formatCount(corpus.chunks)} chunks · {formatCount(corpus.docs)} docs
                </div>
                {corpus.indexedAt !== undefined && (
                  <div>indexed {formatRelative(corpus.indexedAt)}</div>
                )}
              </>
            ) : (
              <span>Waiting for the index…</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-caption text-ink-muted">Theme 04 · PRISM GenAI</span>
          <IconButton
            size="sm"
            label={THEME_LABELS[theme]}
            icon={<ThemeIcon size={15} aria-hidden />}
            onClick={cycleTheme}
          />
        </div>
      </footer>
    </aside>
  );
}
