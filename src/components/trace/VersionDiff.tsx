"use client";

import { ArrowRight, Check, PenLine, Plus } from "lucide-react";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { formatRate } from "@/lib/format";
import { latestVersion, selectVersion } from "@/store/selectors";
import type { AnswerVersion, Turn } from "@/store/types";
import type { Claim } from "@/types/events";

type ClaimKind = "preserved" | "mutated" | "new";

const KIND_META: Record<ClaimKind, { label: string; icon: typeof Check; border: string; text: string }> = {
  preserved: {
    label: "carried from v1",
    icon: Check,
    border: "border-l-ok",
    text: "text-[var(--ok-ink)]",
  },
  mutated: {
    label: "updated",
    icon: PenLine,
    border: "border-l-primary",
    text: "text-primary-ink",
  },
  new: {
    label: "new",
    icon: Plus,
    border: "border-l-[var(--border-strong)]",
    text: "text-ink-muted",
  },
};

function classify(claim: Claim, version: AnswerVersion): ClaimKind {
  if (version.preserved.includes(claim.id)) return "preserved";
  if (version.mutated.includes(claim.id)) return "mutated";
  return "new";
}

function ClaimRow({ claim, version }: { claim: Claim; version: AnswerVersion }) {
  const kind = classify(claim, version);
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  return (
    <li
      className={cn(
        "border-l-2 bg-raised py-1.5 pl-2.5 pr-1",
        meta.border,
        // A rewritten claim flashes once instead of rising, so the eye lands on it.
        kind === "mutated" ? "animate-flash-update" : "animate-rise-in",
      )}
    >
      <p className="text-caption leading-[18px] text-ink-body">{claim.text}</p>
      <p className={cn("mt-0.5 flex items-center gap-1 text-[10px]", meta.text)}>
        <Icon size={10} aria-hidden />
        {meta.label}
        <span className="ml-auto font-mono tabular text-ink-muted">
          support {formatRate(claim.support)} · {claim.chunkIds.length} chunk
          {claim.chunkIds.length === 1 ? "" : "s"}
        </span>
      </p>
    </li>
  );
}

/**
 * The gate-5 visual.
 *
 * Shows the claim-level lineage of a refinement: what a late-arriving detail
 * carried through untouched, and what it rewrote. The prose version of this
 * sits under the answer itself; this is where the per-claim evidence is.
 */
export function VersionDiff({ turn }: { turn: Turn }) {
  const current = selectVersion(turn) ?? latestVersion(turn);

  if (!current) {
    return <EmptyHint>No answer version has been emitted yet.</EmptyHint>;
  }

  if (current.claims.length === 0) {
    return (
      <EmptyHint>
        This turn produced no factual claims to track — a presentation-only turn carries the
        grounding of the previous answer forward.
      </EmptyHint>
    );
  }

  const preserved = current.claims.filter((claim) => classify(claim, current) === "preserved").length;
  const mutated = current.claims.filter((claim) => classify(claim, current) === "mutated").length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {current.parent !== null && (
          <span className="inline-flex items-center gap-1 font-mono text-caption text-ink-muted">
            v{current.parent}
            <ArrowRight size={11} aria-hidden />
            <span className="font-semibold text-ink">v{current.version}</span>
          </span>
        )}
        {current.parent !== null && (
          <>
            <Pill tone="ok">{preserved} preserved</Pill>
            <Pill tone="primary">{mutated} updated</Pill>
          </>
        )}
        <Pill tone={current.citationSupportRate >= 0.85 ? "ok" : "warn"} mono>
          {formatRate(current.citationSupportRate)} supported
        </Pill>
        {current.fabricatedCitations > 0 && (
          <Pill tone="error" mono>
            {current.fabricatedCitations} fabricated
          </Pill>
        )}
      </div>

      <ul className="space-y-1.5">
        {current.claims.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} version={current} />
        ))}
      </ul>
    </div>
  );
}
