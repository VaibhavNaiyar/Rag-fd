"use client";

import { Check, Minus, PenLine, Plus } from "lucide-react";
import type { ClaimDiff, ClaimState } from "@/lib/trace/diff";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";

const STATE_META: Record<ClaimState, { label: string; icon: typeof Check; text: string; border: string }> = {
  preserved: { label: "preserved", icon: Check, text: "text-ok-ink", border: "border-l-ok" },
  rewritten: { label: "rewritten", icon: PenLine, text: "text-diff-rewritten", border: "border-l-diff-rewritten" },
  added: { label: "added", icon: Plus, text: "text-diff-added", border: "border-l-diff-added" },
  removed: { label: "removed", icon: Minus, text: "text-diff-removed", border: "border-l-diff-removed" },
};

/**
 * The G5 proof (P7-F11, replaces `VersionDiff`): what a refinement kept, what
 * it rewrote, what it added and what it dropped, each with its own glyph so
 * the state never depends on colour alone. `diff.inlineDiffAvailable` decides
 * whether a rewritten claim gets a word-level diff or just its new text —
 * true only when both versions came from the live store (`lib/trace/diff.ts`).
 */
export function AnswerDiff({ diff }: { diff: ClaimDiff }) {
  const counts = diff.rows.reduce(
    (acc, row) => ({ ...acc, [row.state]: acc[row.state] + 1 }),
    { preserved: 0, rewritten: 0, added: 0, removed: 0 } as Record<ClaimState, number>,
  );

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
        {(Object.keys(STATE_META) as ClaimState[]).map((state) =>
          counts[state] > 0 ? (
            <span key={state} className={cn("flex items-center gap-1", STATE_META[state].text)}>
              {formatCount(counts[state])} {STATE_META[state].label}
            </span>
          ) : null,
        )}
        {diff.parentClaimCount > 0 && <span>· {formatCount(diff.parentClaimCount)} in the parent</span>}
        {!diff.inlineDiffAvailable && <span>· word-level diff unavailable (trace-only)</span>}
      </p>

      <ul className="space-y-1.5">
        {diff.rows.map((row) => {
          const meta = STATE_META[row.state];
          const Icon = meta.icon;
          return (
            <li key={row.claimId} className={cn("min-w-0 border-l-2 py-1.5 pl-2.5", meta.border)}>
              <p className={cn("mb-0.5 flex items-center gap-1 text-caption font-medium", meta.text)}>
                <Icon size={11} aria-hidden />
                {meta.label}
              </p>
              {row.wordDiff ? (
                <p className="min-w-0 break-words text-trace">
                  {row.wordDiff.map((token, index) =>
                    token.state === "same" ? (
                      <span key={index} className="text-ink-body">
                        {token.text}{" "}
                      </span>
                    ) : token.state === "removed" ? (
                      <span key={index} className="text-diff-removed line-through">
                        {token.text}{" "}
                      </span>
                    ) : (
                      <span key={index} className="text-diff-added">
                        {token.text}{" "}
                      </span>
                    ),
                  )}
                </p>
              ) : (
                <p className="min-w-0 break-words text-trace text-ink-body">{row.text ?? <span className="text-ink-muted">text unavailable</span>}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
