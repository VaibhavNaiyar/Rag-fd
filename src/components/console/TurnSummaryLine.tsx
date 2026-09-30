"use client";

import { formatMs, formatUsd, EMPTY } from "@/lib/format";
import { DECISION_LABELS } from "@/lib/labels";
import { selectTurnSummary } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";
import type { Turn } from "@/store/types";

/** `mode · searches · claims · ttft · complete · cost` (P6-F15) — opens the Inspector on this turn. `—` for whatever the turn does not have yet. */
export function TurnSummaryLine({ turn }: { turn: Turn }) {
  const summary = selectTurnSummary(turn);
  const selectTurn = useAppStore((state) => state.selectTurn);

  const parts = [
    summary.mode ? DECISION_LABELS[summary.mode].label : EMPTY,
    `${summary.searches} search${summary.searches === 1 ? "" : "es"}`,
    `${summary.claims} claim${summary.claims === 1 ? "" : "s"}`,
    `ttft ${formatMs(summary.ttftMs)}`,
    `complete ${formatMs(summary.completeMs)}`,
    formatUsd(summary.costUsd),
  ];

  return (
    <button
      type="button"
      onClick={() => selectTurn({ sessionId: turn.sessionId, turnId: turn.id })}
      className="mt-2 flex min-h-hit w-full min-w-0 flex-wrap items-center gap-x-1.5 rounded-2 px-1 py-1 font-mono text-caption text-ink-muted transition-colors duration-1 ease-standard hover:bg-surface-2 hover:text-ink"
    >
      {parts.map((part, index) => (
        <span key={index} className="tabular">
          {part}
          {index < parts.length - 1 && <span aria-hidden className="ml-1.5 text-line-strong">·</span>}
        </span>
      ))}
    </button>
  );
}
