"use client";

import { ArrowRight, Check, Coins, PenLine, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { EmptyHint } from "@/components/ui/EmptyHint";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { formatCount, formatRate, formatUsd } from "@/lib/format";
import { latestVersion, selectVersion } from "@/store/selectors";
import type { AnswerVersion, Turn } from "@/store/types";
import type { Claim } from "@/types/events";

type ClaimKind = "preserved" | "mutated" | "new";

/**
 * Preserved/rewritten use the same red-green convention as any code diff —
 * unambiguous at a glance, and distinct from this app's own "red = error"
 * rule elsewhere (fabricated citations) because a rewritten claim is always
 * paired with the PenLine icon and the word "rewritten," never an error icon
 * or the word "failed." Colour is never the only signal here.
 */
const KIND_META: Record<
  ClaimKind,
  { label: string; icon: typeof Check; border: string; wash: string; text: string }
> = {
  preserved: {
    label: "carried from v1",
    icon: Check,
    border: "border-l-ok",
    wash: "bg-ok-soft",
    text: "text-[var(--ok-ink)]",
  },
  mutated: {
    label: "rewritten",
    icon: PenLine,
    border: "border-l-error",
    wash: "bg-error-soft",
    text: "text-error",
  },
  new: {
    label: "new",
    icon: Plus,
    border: "border-l-[var(--border-strong)]",
    wash: "bg-raised",
    text: "text-ink-muted",
  },
};

/** Claim rows beyond this many are collapsed behind "Show N more" by default. */
const VISIBLE_CLAIMS = 6;

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
        "min-w-0 border-l-2 py-1.5 pl-2.5 pr-1",
        meta.border,
        meta.wash,
        // A rewritten claim flashes once instead of rising, so the eye lands on it.
        kind === "mutated" ? "animate-flash-update" : "animate-rise-in",
      )}
    >
      <p className="break-words text-caption leading-[18px] text-ink-body">{claim.text}</p>
      <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px]", meta.text)}>
        <Icon size={10} aria-hidden className="shrink-0" />
        {meta.label}
        <span className="ml-auto font-mono tabular text-ink-muted">
          support {formatRate(claim.support)} · {claim.chunkIds.length} chunk
          {claim.chunkIds.length === 1 ? "" : "s"}
        </span>
      </p>
    </li>
  );
}

/** The turn-level telemetry strip: real cost/token figures, never estimated. */
function CostBadges({ turn }: { turn: Turn }) {
  if (!turn.cost) return null;
  return (
    <>
      <Pill tone="neutral" mono icon={<Coins size={11} aria-hidden />}>
        {formatCount(turn.cost.turnTokens)} tok · {formatUsd(turn.cost.turnUsd)}
      </Pill>
    </>
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
  const [expanded, setExpanded] = useState(false);

  if (!current) {
    return <EmptyHint>No answer version has been emitted yet.</EmptyHint>;
  }

  if (current.claims.length === 0) {
    return (
      <EmptyHint>
        This turn produced no factual claims to track. A presentation-only turn carries the
        grounding of the previous answer forward.
      </EmptyHint>
    );
  }

  const preserved = current.claims.filter((claim) => classify(claim, current) === "preserved").length;
  const mutated = current.claims.filter((claim) => classify(claim, current) === "mutated").length;
  const isRefinement = current.parent !== null;

  const visibleClaims = expanded ? current.claims : current.claims.slice(0, VISIBLE_CLAIMS);
  const hiddenCount = current.claims.length - visibleClaims.length;

  return (
    <div className="min-w-0">
      {/* Executive summary strip: the whole G5 story in one glance, wrapping cleanly at any width. */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {isRefinement && (
          <span className="inline-flex items-center gap-1 font-mono text-caption text-ink-muted">
            v{current.parent}
            <ArrowRight size={11} aria-hidden />
            <span className="font-semibold text-ink">v{current.version}</span>
          </span>
        )}
        {isRefinement && (
          <>
            <Pill tone="ok">{preserved} preserved</Pill>
            <Pill tone="error">{mutated} rewritten</Pill>
            <Pill
              tone={current.fullCorpusSearch ? "neutral" : "brand"}
              icon={<ShieldCheck size={11} aria-hidden />}
            >
              {current.fullCorpusSearch ? "full-corpus search re-run" : "no full-corpus search"}
            </Pill>
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
        <CostBadges turn={turn} />
      </div>

      <ul className="space-y-1.5">
        {visibleClaims.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} version={current} />
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 text-caption font-medium text-primary-ink hover:underline"
        >
          Show {hiddenCount} more claim{hiddenCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
