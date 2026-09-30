"use client";

import { ConnectionState } from "@/components/shell/ConnectionState";
import { CopyButton } from "@/components/ui/CopyButton";
import { useStatusFacts } from "@/hooks/useStatusFacts";
import { formatCount, formatMs } from "@/lib/format";
import { describeHealth, type HealthResult } from "@/lib/health";

/**
 * The same facts as the status strip, as a list, for the menu on a phone, where there is
 * no strip. Same hook, same wording, so they cannot disagree.
 */
export function StatusFacts({ health }: { health: HealthResult }) {
  const facts = useStatusFacts();

  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-label">
      <dt className="text-ink-muted">Engine</dt>
      <dd className="m-0 flex min-w-0 flex-col gap-1">
        <ConnectionState live={false} />
        <span className="break-words text-caption text-ink-muted">{describeHealth(health)}</span>
      </dd>

      <dt className="text-ink-muted">Session</dt>
      <dd className="m-0 flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate font-mono text-ink-body" data-fact="session">
          {facts.sessionId ?? "—"}
        </span>
        {facts.sessionId && <CopyButton value={facts.sessionId} label="Copy session id" />}
      </dd>

      <dt className="text-ink-muted">Turns</dt>
      <dd className="m-0 font-mono tabular text-ink-body" data-fact="turns">
        {facts.turns}
      </dd>

      <dt className="text-ink-muted">Last turn</dt>
      <dd className="m-0 font-mono tabular text-ink-body" data-fact="last-turn">
        {formatMs(facts.lastTurnMs)}
      </dd>

      {facts.corpus && (
        <>
          <dt className="text-ink-muted">Corpus</dt>
          <dd className="m-0 font-mono tabular text-ink-body" data-fact="corpus">
            {formatCount(facts.corpus.docs)} docs, {formatCount(facts.corpus.chunks)} chunks
          </dd>
        </>
      )}
    </dl>
  );
}
