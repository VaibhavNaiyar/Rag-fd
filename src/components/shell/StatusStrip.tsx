"use client";

import { ConnectionState } from "@/components/shell/ConnectionState";
import { CopyButton } from "@/components/ui/CopyButton";
import { useStatusFacts } from "@/hooks/useStatusFacts";
import { formatCount, formatMs } from "@/lib/format";
import { describeHealth, type HealthResult } from "@/lib/health";

/**
 * A 24 px strip along the bottom, from 768 px up: the state of the connection, the
 * engine's health, the session id (mono, truncating, with a copy button), how many
 * turns there have been, and how long the last one took. Every value is read from the
 * store, through the same hook the phone menu uses, so the two cannot disagree. Below
 * 768 px there is no room for it, and the same facts are in the menu.
 */
export function StatusStrip({ health }: { health: HealthResult }) {
  const facts = useStatusFacts();

  return (
    <footer className="frame-bottom relative hidden h-status bg-surface pl-safe-left pr-safe-right text-caption text-ink-muted before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-line md:block">
      <div className="flex h-full min-w-0 items-center gap-4 px-gutter">
        <ConnectionState live={false} className="shrink-0" />
        <span className="hidden min-w-0 truncate lg:inline" data-fact="health">
          {describeHealth(health)}
        </span>
        {facts.corpus && (
          <span className="hidden shrink-0 font-mono tabular xl:inline" data-fact="corpus">
            {formatCount(facts.corpus.docs)} docs, {formatCount(facts.corpus.chunks)} chunks
          </span>
        )}
        <span className="ml-auto flex min-w-0 items-center gap-1" data-fact="session">
          <span className="shrink-0">Session</span>
          <span className="min-w-0 truncate font-mono text-ink-body">{facts.sessionId ?? "—"}</span>
          {facts.sessionId && <CopyButton value={facts.sessionId} label="Copy session id" size="xs" />}
        </span>
        <span className="shrink-0" data-fact="turns">
          Turns <span className="font-mono tabular text-ink-body">{facts.turns}</span>
        </span>
        <span className="shrink-0" data-fact="last-turn">
          Last turn <span className="font-mono tabular text-ink-body">{formatMs(facts.lastTurnMs)}</span>
        </span>
      </div>
    </footer>
  );
}
