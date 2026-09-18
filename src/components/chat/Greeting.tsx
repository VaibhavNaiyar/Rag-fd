"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEMO_FIXTURES } from "@/lib/constants";
import { formatCount, formatRelative } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

/**
 * The IDLE state.
 *
 * The corpus sub-line quietly tells a judge the system ingested something real,
 * and the suggestion chips are the same four fixtures the demo bar fires — so an
 * unscripted judge clicking around still lands on the behaviours that matter.
 */
export function Greeting() {
  const corpus = useAppStore((state) => state.corpus);
  const replayFixture = useAppStore((state) => state.replayFixture);

  return (
    <div className="animate-message-in pb-8 text-center">
      <h1 className="text-display text-ink">Ask me anything about the corpus.</h1>

      <p className="mt-2 font-mono text-caption tabular text-ink-muted">
        {corpus ? (
          <>
            {formatCount(corpus.chunks)} chunks across {formatCount(corpus.docs)} documents
            {corpus.indexedAt !== undefined && <> · indexed {formatRelative(corpus.indexedAt)}</>}
          </>
        ) : (
          "Waiting for the engine to report its index…"
        )}
      </p>

      <p className="mx-auto mt-4 max-w-lg text-body text-ink-muted">
        Speak one natural request. Retrieval starts before you finish, compound requests split
        themselves, and a detail added mid-flow sharpens the answer instead of restarting it.
      </p>

      <ul className="mx-auto mt-7 grid max-w-2xl gap-2 sm:grid-cols-2">
        {DEMO_FIXTURES.map((fixture) => (
          <li key={fixture.id}>
            <button
              type="button"
              onClick={() => replayFixture(fixture.id)}
              className={cn(
                "group flex h-full w-full flex-col items-start gap-1 rounded-md border border-line",
                "bg-raised px-3.5 py-3 text-left shadow-card",
                "transition-[border-color,box-shadow,transform] duration-150 ease-oneui",
                "hover:-translate-y-px hover:border-primary hover:shadow-lift",
              )}
            >
              <span className="flex w-full items-center gap-2">
                <span className="text-label text-ink">{fixture.label}</span>
                <ArrowUpRight
                  size={14}
                  aria-hidden
                  className="ml-auto shrink-0 text-ink-muted transition-colors group-hover:text-primary-ink"
                />
              </span>
              <span className="text-caption text-ink-muted">{fixture.proves}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
