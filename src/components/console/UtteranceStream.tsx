"use client";

import { StatusDot } from "@/components/ui/StatusDot";
import { formatMs } from "@/lib/format";
import { DECISION_LABELS, reasonLabel } from "@/lib/labels";
import type { ControllerDecisionRecord, Turn } from "@/store/types";

export interface UtteranceStreamProps {
  turn: Turn;
  /** What the client is typing out live, shown before it round-trips as a transcript chunk. Only meaningful on the turn currently listening. */
  draft?: string;
  /** Whether to show the draft's caret. False once the turn has moved on. */
  live?: boolean;
}

type Item = { kind: "chunk"; atMs: number; text: string } | { kind: "decision"; atMs: number; decision: ControllerDecisionRecord };

/** Chunks and decisions merged into one time-ordered sequence — a decision renders right after the transcript that produced it, never detached into a separate log. */
function timeline(turn: Turn): Item[] {
  const items: Item[] = [
    ...turn.transcript.map((chunk): Item => ({ kind: "chunk", atMs: chunk.atMs, text: chunk.text })),
    ...turn.decisions.map((decision): Item => ({ kind: "decision", atMs: decision.atMs, decision })),
  ];
  return items.sort((a, b) => a.atMs - b.atMs);
}

/** What was said, with time offsets and inline controller markers (P6-F04, replaces `TranscriptStrip`'s draft view). Colour never carries the decision alone — each marker has a shape (`StatusDot`) and a text label. */
export function UtteranceStream({ turn, draft, live = false }: UtteranceStreamProps) {
  const items = timeline(turn);

  return (
    <p className="min-w-0 break-words text-body text-ink-body">
      {items.map((item, index) =>
        item.kind === "chunk" ? (
          <span key={index}>
            {index > 0 && " "}
            {item.text}
            <span className="ml-1 align-super font-mono text-caption text-ink-muted">{formatMs(item.atMs)}</span>
          </span>
        ) : (
          <span key={index} className="mx-1 inline-flex items-center gap-1 align-middle font-mono text-caption text-ink-muted">
            <StatusDot shape={DECISION_LABELS[item.decision.decision].shape} tone={DECISION_LABELS[item.decision.decision].tone} label={DECISION_LABELS[item.decision.decision].label} />
            {DECISION_LABELS[item.decision.decision].label.toLowerCase()} · {reasonLabel(item.decision.reason)}
          </span>
        ),
      )}
      {live && (
        <>
          {items.length > 0 && " "}
          {draft}
          {/* A static caret — no animation beyond `LiveStrip`'s own timer (P1's token scale allows only spin and sheet-in). */}
          <span aria-hidden className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-accent align-middle" />
        </>
      )}
    </p>
  );
}
