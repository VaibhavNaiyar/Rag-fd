"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ClaimsTable } from "@/components/inspector/ClaimsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Segmented } from "@/components/ui/Segmented";
import { createCitationRenderers } from "@/lib/citations";
import type { Hit } from "@/types/events";
import type { TraceRecord } from "@/types/trace";

const REMARK_PLUGINS = [remarkGfm];

export interface AnswerPanelProps {
  record: TraceRecord;
  /** Full-text evidence, when this turn is still live — lets citation markers resolve to a source. A trace-only record has no chunk text to resolve them against. */
  liveEvidence?: readonly Hit[];
  version: number | null;
  onVersionChange: (version: number) => void;
}

/**
 * The answer, with citations and its claims table (P7-F09). The trace record
 * keeps only its *last* answer version — `versions` here is either every live
 * version (while the turn is still in this session) or just that one.
 */
export function AnswerPanel({ record, liveEvidence, version, onVersionChange }: AnswerPanelProps) {
  const answer = record.answer;
  const renderers = useMemo(() => createCitationRenderers([...(liveEvidence ?? [])]), [liveEvidence]);

  if (!answer || answer.body.length === 0) {
    return (
      <EmptyState title="No answer" level={4}>
        This turn produced no answer text.
      </EmptyState>
    );
  }

  // The record itself only ever names one version (its own) — a version switch here
  // is meaningful only when the caller also has the live store's earlier ones.
  const availableVersions = version !== null ? [version] : [answer.version];

  return (
    <div className="space-y-3">
      {availableVersions.length > 1 && (
        <Segmented
          label="Version"
          size="sm"
          value={String(version)}
          onValueChange={(v) => onVersionChange(Number(v))}
          options={availableVersions.map((v) => ({ value: String(v), label: `v${v}` }))}
        />
      )}

      {liveEvidence ? (
        <div className="answer-prose text-body text-ink-body">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={renderers}>
            {answer.body}
          </ReactMarkdown>
        </div>
      ) : (
        <>
          <InlineAlert tone="info">This turn&rsquo;s trace has no chunk text, so citation markers below are not resolved to a source — open the turn while it is still live for that.</InlineAlert>
          <div className="answer-prose text-body text-ink-body">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{answer.body}</ReactMarkdown>
          </div>
        </>
      )}

      <ClaimsTable claims={answer.claims} />
    </div>
  );
}
