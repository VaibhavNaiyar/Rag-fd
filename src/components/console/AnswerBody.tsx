"use client";

import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { announce } from "@/components/ui/a11y";
import { useThrottledValue } from "@/hooks/useThrottledValue";
import { createCitationRenderers } from "@/lib/citations";
import type { AnswerVersion } from "@/store/types";
import type { Hit } from "@/types/events";

const REMARK_PLUGINS = [remarkGfm];

/** Re-parses at most 8 times a second (PB-03) — a token batcher can push updates every animation frame, but re-running the markdown parser that often is pure waste on a growing string. */
const PARSE_INTERVAL_MS = 125;

export interface AnswerBodyProps {
  version: AnswerVersion;
  evidence: Hit[];
}

/**
 * The streaming answer (P6-F07). No `aria-live` on the body itself — announcing
 * every token would drown a screen-reader user in noise — instead one polite
 * announcement when the version starts producing text, and one when it
 * completes, naming how many claims it made.
 */
export function AnswerBody({ version, evidence }: AnswerBodyProps) {
  const body = useThrottledValue(version.body, PARSE_INTERVAL_MS);
  const renderers = useMemo(() => createCitationRenderers(evidence), [evidence]);
  const announcedStart = useRef<number | null>(null);
  const announcedComplete = useRef<number | null>(null);

  useEffect(() => {
    if (version.body.length > 0 && announcedStart.current !== version.version) {
      announcedStart.current = version.version;
      announce(version.parent === null ? "Answer started." : `Version ${version.version} started.`, "polite");
    }
  }, [version.body.length, version.version, version.parent]);

  useEffect(() => {
    if (version.complete && announcedComplete.current !== version.version) {
      announcedComplete.current = version.version;
      announce(`Answer complete, ${version.claims.length} claim${version.claims.length === 1 ? "" : "s"}.`, "polite");
    }
  }, [version.complete, version.version, version.claims.length]);

  if (body.length === 0) return null;

  return (
    <div className="answer-prose text-body text-ink-body">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={renderers}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
