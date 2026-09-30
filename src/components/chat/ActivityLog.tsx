"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { EvidenceCard } from "@/components/trace/EvidenceCard";
import { ControllerTimeline } from "@/components/trace/ControllerTimeline";
import { EvidenceList } from "@/components/trace/EvidenceList";
import { MetricsBar } from "@/components/trace/MetricsBar";
import { SubQueryList } from "@/components/trace/SubQueryList";
import { VersionDiff } from "@/components/trace/VersionDiff";
import { cn } from "@/lib/cn";
import { TRIGGER_LABELS, reasonLabel } from "@/lib/decisions";
import { formatCount, formatLead, formatMs, formatRate, formatUsd } from "@/lib/format";
import { retrievalLeadMs } from "@/store/selectors";
import type { Turn } from "@/store/types";

/**
 * What the engine did on a turn, as a list of steps above the answer, one row
 * per thing that happened, each expandable into its evidence.
 *
 * Every row is read off the turn the AG-UI stream built: the `listen` step and
 * the controller decisions in shared state, one row per `corpus_search` tool
 * call, the sub-queries and fusion from shared state, one row per answer
 * version, and the run's telemetry once RUN_FINISHED lands. Open while the turn
 * runs, folded to its one-line summary once it is done.
 */

/** The row's left-rail accent — genuine status only (ok/warn/error/an active
 *  gate), never one colour per row type, so colour stays a signal instead of
 *  decoration. Rows with nothing notable to report get the neutral rail. */
type RowTone = "neutral" | "primary" | "brand" | "ok" | "warn" | "error";

interface Row {
  id: string;
  text: ReactNode;
  tone?: RowTone;
  badge?: { label: string; tone: "muted" | "error" | "ok" };
  detail?: ReactNode;
}

const TONE_BORDER: Record<RowTone, string> = {
  neutral: "border-l-line",
  primary: "border-l-primary",
  brand: "border-l-brand",
  ok: "border-l-ok",
  warn: "border-l-warn",
  error: "border-l-error",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

function buildRows(turn: Turn): Row[] {
  const rows: Row[] = [];

  if (turn.transcript.length > 0) {
    const lead = retrievalLeadMs(turn);
    const early = lead !== null && lead > 0;
    rows.push({
      id: "listen",
      text: (
        <>
          Listened to {plural(turn.transcript.length, "transcript chunk")}
          {early && <> and started searching {formatLead(lead)} before you finished</>}
        </>
      ),
      // Primary the moment G2's early-retrieval win is first mentioned — the
      // same blue the timeline below uses for the retrieval marker itself.
      tone: early ? "primary" : "neutral",
      detail: <ControllerTimeline turn={turn} />,
    });
  }

  const suppress = turn.decisions.find((d) => d.decision === "suppress");
  if (suppress) {
    rows.push({
      id: "suppress",
      text: <>Recognised a request to re-present the last answer, so nothing was searched</>,
      badge: { label: reasonLabel(suppress.reason), tone: "muted" },
    });
  }
  if (turn.decisions.some((d) => d.decision === "refine")) {
    rows.push({ id: "refine", text: <>Treated this as a detail on your previous request</>, tone: "brand" });
  }

  for (const search of [...turn.retrievals].sort((a, b) => a.atMs - b.atMs)) {
    const kept = turn.evidence.filter((hit) => hit.subQueryIds.includes(search.subQueryId));
    const stats = turn.subQueries.find((sub) => sub.id === search.subQueryId);
    rows.push({
      id: `search:${search.subQueryId}`,
      text: (
        <>
          {search.cancelledReason ? "Dropped the search" : "Searched"}{" "}
          <span className="text-ink">“{search.query}”</span>
          <span className="text-ink-muted"> · {TRIGGER_LABELS[search.trigger]} · at {formatMs(search.atMs)}</span>
        </>
      ),
      tone: search.cancelledReason ? "error" : "primary",
      badge: search.cancelledReason
        ? { label: `Cancelled: ${reasonLabel(search.cancelledReason)}`, tone: "error" }
        : undefined,
      detail:
        kept.length > 0 ? (
          <>
            {stats?.candidates !== undefined && (
              <p className="mb-2 text-caption text-ink-muted">
                {plural(stats.candidates, "candidate")} scored, {formatCount(kept.length)} kept
              </p>
            )}
            <ul className="space-y-2">
              {kept.map((hit, index) => (
                <EvidenceCard key={hit.chunkId} hit={hit} index={index} />
              ))}
            </ul>
          </>
        ) : undefined,
    });
  }

  const decomposed = turn.subQueries.filter((sub) => sub.source === "decomposed");
  if (decomposed.length > 0) {
    rows.push({
      id: "split",
      text:
        decomposed.length > 1 ? (
          <>Split your request into {formatCount(decomposed.length)} questions</>
        ) : (
          <>Kept it as one question</>
        ),
      detail: <SubQueryList turn={turn} />,
    });
  }

  if (turn.evidence.length > 0 && turn.versions.length > 0) {
    rows.push({
      id: "fuse",
      text: (
        <>
          Fused and reranked {plural(turn.evidence.length, "passage")}
          {turn.quotaApplied && <span className="text-ink-muted"> · every question kept its own evidence</span>}
        </>
      ),
      detail: <EvidenceList turn={turn} />,
    });
  }

  for (const version of turn.versions.filter((v) => v.complete)) {
    const unverified = version.uncertainty.length;
    rows.push({
      id: `v${version.version}`,
      text:
        version.parent === null ? (
          <>
            Wrote the answer: {plural(version.claims.length, "claim")},{" "}
            {formatRate(version.citationSupportRate)} backed by a cited passage
            {unverified > 0 && <>, {formatCount(unverified)} left unverified</>}
          </>
        ) : (
          <>
            Refined it to v{version.version}: {formatCount(version.preserved.length)} kept,{" "}
            {formatCount(version.mutated.length)} rewritten,{" "}
            {version.fullCorpusSearch ? "full-corpus search re-run" : "no full-corpus search"}
          </>
        ),
      // The version's actual outcome, not just "an answer happened": clean
      // grounding is ok, real uncertainty is warn, a fabricated citation is
      // error — matching how the same three states already read everywhere
      // else in the trace rail (Pill/Stat tones, VersionDiff's own badges).
      tone: version.fabricatedCitations > 0 ? "error" : unverified > 0 ? "warn" : "ok",
      badge: version.fabricatedCitations > 0 ? { label: `${version.fabricatedCitations} fabricated`, tone: "error" } : undefined,
      detail: turn.versions.length > 1 ? <VersionDiff turn={turn} /> : undefined,
    });
  }

  if (turn.status === "complete" && turn.latencyMs) {
    rows.push({
      id: "done",
      text: (
        <>
          Done: first token {formatMs(turn.latencyMs.firstToken)} after you finished
          {turn.cost && <> · {formatUsd(turn.cost.turnUsd)}</>}
        </>
      ),
      tone: "ok",
      detail: <MetricsBar turn={turn} />,
    });
  }

  if (turn.status === "error") {
    rows.push({
      id: "error",
      text: <>{turn.errorMessage ?? "The engine reported an error on this turn."}</>,
      tone: "error",
      badge: { label: "Failed", tone: "error" },
    });
  }

  return rows;
}

const LIVE_LABEL: Record<string, string> = {
  listening: "Listening…",
  retrieving: "Searching the corpus…",
  answering: "Writing the answer…",
};

function summary(turn: Turn): string {
  const searches = turn.retrievals.filter((r) => !r.cancelledReason).length;
  if (turn.decisions.some((d) => d.decision === "suppress") && searches === 0) return "Answered from the session, no search";
  const parts = [plural(searches, "search", "searches")];
  if (turn.evidence.length > 0) parts.push(`read ${plural(turn.evidence.length, "passage")}`);
  return `Ran ${parts.join(", ")}`;
}

const BADGE_TONE = {
  muted: "text-ink-muted",
  ok: "text-[var(--ok-ink)]",
  error: "text-error",
};

function ActivityRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const content = (
    <>
      {/* break-words alongside min-w-0/flex-1: a row can carry the error message,
          or a raw search.query the user typed — neither is guaranteed to contain
          a wrap point, so min-w-0's flex-sizing fix alone isn't enough at 375px. */}
      <span className="min-w-0 flex-1 break-words">{row.text}</span>
      {row.badge && <span className={cn("shrink-0 font-medium", BADGE_TONE[row.badge.tone])}>{row.badge.label}</span>}
      {row.detail && (
        <ChevronRight
          size={14}
          aria-hidden
          className={cn("shrink-0 text-ink-muted transition-transform", open && "rotate-90")}
        />
      )}
    </>
  );

  return (
    <li className={cn("border-l-[3px] border-t border-line first:border-t-0", TONE_BORDER[row.tone ?? "neutral"])}>
      {row.detail ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-body text-ink-muted transition-colors hover:bg-sunken"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3.5 py-2.5 text-body text-ink-muted">{content}</div>
      )}
      {open && row.detail && <div className="animate-rise-in border-t border-line px-3.5 py-3">{row.detail}</div>}
    </li>
  );
}

export function ActivityLog({ turn }: { turn: Turn }) {
  const running = turn.status !== "complete" && turn.status !== "error";
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? running;
  const rows = buildRows(turn);
  const live = running ? LIVE_LABEL[turn.status] : undefined;

  return (
    <section aria-label="What the engine did" aria-live="off" className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
        className="mb-2 flex items-center gap-1.5 text-body text-ink-muted transition-colors hover:text-ink"
      >
        {running ? <span className="shimmer-ai animate-shimmer font-medium">{live}</span> : summary(turn)}
        <ChevronDown size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && rows.length > 0 && (
        <ol className="overflow-hidden rounded-lg border border-line bg-raised">
          {rows.map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </ol>
      )}
    </section>
  );
}
