"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SuppressedNote } from "@/components/chat/SuppressedNote";
import { UncertaintyNote } from "@/components/chat/UncertaintyNote";
import { VersionPills } from "@/components/chat/VersionPills";
import { Pill } from "@/components/ui/Pill";
import { createCitationRenderers } from "@/lib/citations";
import { formatMs, formatRate } from "@/lib/format";
import { isSuppressed, selectVersion } from "@/store/selectors";
import type { Turn } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";

const REMARK_PLUGINS = [remarkGfm];

/** The line that carries the G5 proof, in prose rather than an icon. */
function RefinementLine({ turn, version }: { turn: Turn; version: number }) {
  const current = selectVersion(turn, version);
  if (!current || current.parent === null) return null;

  const preserved = current.preserved.length;
  const mutated = current.mutated.length;

  return (
    <p className="mt-3 border-t border-line pt-2.5 text-caption text-ink-muted">
      Refined from v{current.parent} — {preserved} {preserved === 1 ? "claim" : "claims"} preserved,{" "}
      {mutated} updated,{" "}
      <span className={current.fullCorpusSearch ? undefined : "font-medium text-[var(--ok-ink)]"}>
        {current.fullCorpusSearch ? "full-corpus search re-run" : "no full-corpus search"}
      </span>
      .
    </p>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <p className="shimmer-ai animate-shimmer text-body font-medium" aria-live="polite">
      {label}
    </p>
  );
}

export function AssistantMessage({ turn }: { turn: Turn }) {
  const setActiveVersion = useAppStore((state) => state.setActiveVersion);

  const version = selectVersion(turn);
  const suppressed = isSuppressed(turn);
  const suppressReason =
    turn.decisions.find((decision) => decision.decision === "suppress")?.reason ?? "";

  // Rebuilt only when the evidence set changes, so streaming tokens stay cheap.
  const renderers = useMemo(() => createCitationRenderers(turn.evidence), [turn.evidence]);

  const waitingLabel =
    turn.status === "retrieving"
      ? "Retrieving across sub-queries…"
      : turn.status === "listening"
        ? "Listening…"
        : "Composing the answer…";

  return (
    <div className="animate-message-in">
      {suppressed && <SuppressedNote reason={suppressReason} />}

      {turn.status === "error" ? (
        <p className="rounded-md border border-edge-error bg-error-soft px-3.5 py-3 text-body text-error">
          {turn.errorMessage ?? "The engine reported an error on this turn."}
        </p>
      ) : version && version.body.length > 0 ? (
        <div className="answer-prose text-body text-ink-body" aria-live="polite" aria-atomic="false">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={renderers}>
            {version.body}
          </ReactMarkdown>
        </div>
      ) : (
        <ThinkingIndicator label={waitingLabel} />
      )}

      {version && <UncertaintyNote items={version.uncertainty} />}
      {version && <RefinementLine turn={turn} version={version.version} />}

      {(turn.versions.length > 1 || turn.status === "complete") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VersionPills
            versions={turn.versions}
            activeVersion={turn.activeVersion}
            onSelect={(next) => setActiveVersion(turn.id, next)}
          />

          {version && version.complete && (
            <Pill
              tone={version.citationSupportRate >= 0.85 ? "ok" : "warn"}
              mono
              title="Share of factual claims backed by a cited corpus chunk"
            >
              {formatRate(version.citationSupportRate)} supported
            </Pill>
          )}

          {version && version.fabricatedCitations > 0 && (
            <Pill tone="error" mono>
              {version.fabricatedCitations} fabricated
            </Pill>
          )}

          {turn.latencyMs && (
            <Pill mono title="Time to first token, measured from the end of the utterance">
              TTFT {formatMs(turn.latencyMs.firstToken)}
            </Pill>
          )}
        </div>
      )}
    </div>
  );
}
