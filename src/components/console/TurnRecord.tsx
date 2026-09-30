"use client";

import { forwardRef, type ReactNode } from "react";
import { AnswerBody } from "@/components/console/AnswerBody";
import { ClarifyChoices } from "@/components/console/ClarifyChoices";
import { LiveStrip } from "@/components/console/LiveStrip";
import { TurnSummaryLine } from "@/components/console/TurnSummaryLine";
import { UncertaintyList } from "@/components/console/UncertaintyList";
import { UtteranceStream } from "@/components/console/UtteranceStream";
import { VersionSwitch } from "@/components/console/VersionSwitch";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatMs, EMPTY } from "@/lib/format";
import { DECISION_LABELS, reasonLabel, SEARCH_CALL_LABELS, type SearchCallState } from "@/lib/labels";
import { latestDecision, selectVersion } from "@/store/selectors";
import type { AnswerVersion, ControllerDecisionRecord, RetrievalRecord, Turn } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";

/**
 * One turn's ordered content (P6-F03): the utterance, the decision that
 * triggered what happened, one row per search (each a small state machine —
 * running, kept or cancelled), the answer, uncertainty and a clarification
 * request. `Part` is exhaustive: a new kind with no case in {@link renderPart}
 * fails to compile, not silently renders nothing.
 */
export type Part =
  | { kind: "utterance" }
  | { kind: "decisionStep"; decision: ControllerDecisionRecord }
  | { kind: "search"; search: RetrievalRecord; state: SearchCallState }
  | { kind: "answer"; version: AnswerVersion }
  | { kind: "uncertainty"; version: AnswerVersion }
  | { kind: "clarify"; version: AnswerVersion };

function searchState(turn: Turn, search: RetrievalRecord): SearchCallState {
  if (search.cancelledReason) return "cancelled";
  const stats = turn.subQueries.find((sub) => sub.id === search.subQueryId);
  return stats?.keptCount === undefined ? "running" : "kept";
}

export function buildParts(turn: Turn): Part[] {
  const parts: Part[] = [{ kind: "utterance" }];

  // A retrieve is already evident from the search rows below (and from the inline
  // markers `UtteranceStream` draws into the transcript itself) — a standalone divider
  // for it would just repeat the same "retrieve · <reason>" text a second time. Suppress
  // and refine have no search rows of their own, so they are the cases worth calling out.
  const triggering = [...turn.decisions].reverse().find((decision) => decision.decision === "suppress" || decision.decision === "refine");
  if (triggering) parts.push({ kind: "decisionStep", decision: triggering });

  for (const search of [...turn.retrievals].sort((a, b) => a.atMs - b.atMs)) {
    parts.push({ kind: "search", search, state: searchState(turn, search) });
  }

  const version = selectVersion(turn);
  if (version) {
    if (version.body.length > 0 || turn.status === "complete") parts.push({ kind: "answer", version });
    if (version.uncertainty.length > 0) parts.push({ kind: "uncertainty", version });
    if (version.clarification.length > 0) parts.push({ kind: "clarify", version });
  }

  return parts;
}

function DecisionStepDivider({ decision }: { decision: ControllerDecisionRecord }) {
  const meta = DECISION_LABELS[decision.decision];
  return (
    <div className="my-2 flex min-w-0 items-center gap-2 text-caption text-ink-muted">
      <span aria-hidden className="h-px flex-1 bg-line" />
      <StatusDot shape={meta.shape} tone={meta.tone} label={meta.label} />
      <span className="min-w-0 truncate">
        {meta.label} · {reasonLabel(decision.reason)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

function SearchCallRow({ search, state }: { search: RetrievalRecord; state: SearchCallState }) {
  const meta = SEARCH_CALL_LABELS[state];
  return (
    <div className="flex min-w-0 items-center gap-2 py-1 text-caption text-ink-muted">
      <StatusDot shape={meta.shape} tone={meta.tone} label={meta.label} />
      <span className="min-w-0 truncate">
        <span className="text-ink">“{search.query}”</span>
        <span className="ml-1.5">
          {meta.label.toLowerCase()} · at {formatMs(search.atMs)}
        </span>
      </span>
    </div>
  );
}

interface RenderCtx {
  turn: Turn;
  draft: string;
  isLive: boolean;
}

/** The one place a `Part` becomes UI. Exhaustive: `default` narrows `part` to `never`, so a new kind with no case above fails to compile rather than silently rendering nothing. */
function renderPart(part: Part, ctx: RenderCtx): ReactNode {
  switch (part.kind) {
    case "utterance":
      return <UtteranceStream turn={ctx.turn} draft={ctx.draft} live={ctx.isLive && ctx.turn.status === "listening"} />;
    case "decisionStep":
      return <DecisionStepDivider decision={part.decision} />;
    case "search":
      return <SearchCallRow search={part.search} state={part.state} />;
    case "answer":
      return (
        <>
          <AnswerBody version={part.version} evidence={ctx.turn.evidence} />
          {ctx.turn.versions.length > 1 && (
            <div className="mt-2">
              <VersionSwitch versions={ctx.turn.versions} activeVersion={ctx.turn.activeVersion} onSelect={(v) => useAppStore.getState().setActiveVersion(ctx.turn.id, v)} />
            </div>
          )}
        </>
      );
    case "uncertainty":
      return <UncertaintyList items={part.version.uncertainty} />;
    case "clarify":
      return <ClarifyChoices options={part.version.clarification} />;
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
}

export interface TurnRecordProps {
  turn: Turn;
  /** Spread onto the root `article` — a feed's children carry their own position among their siblings (WAI-ARIA feed pattern), which is `TurnLedger`'s job, not this component's. */
  "aria-posinset"?: number;
  "aria-setsize"?: number;
  "aria-current"?: "true";
  tabIndex?: number;
}

export const TurnRecord = forwardRef<HTMLElement, TurnRecordProps>(function TurnRecord({ turn, ...articleProps }, ref) {
  const draft = useAppStore((state) => state.draftTranscript);
  const isLive = turn.status !== "complete" && turn.status !== "error";
  const mode = latestDecision(turn)?.decision ?? null;
  const parts = buildParts(turn);
  const ctx: RenderCtx = { turn, draft, isLive };

  return (
    <article ref={ref} aria-label={`Turn ${turn.id}`} className="min-w-0 outline-none" {...articleProps}>
      <header className="mb-1.5 flex min-w-0 items-center gap-2 font-mono text-caption text-ink-muted">
        <span className="truncate">{turn.id}</span>
        {mode && <span className="text-ink">{DECISION_LABELS[mode].label}</span>}
        <span className="ml-auto tabular">{turn.latencyMs ? formatMs(turn.latencyMs.complete) : EMPTY}</span>
        <span className="capitalize">{turn.status}</span>
      </header>

      {isLive && <LiveStrip turn={turn} />}

      {parts.map((part, index) => (
        <div key={index} className={part.kind === "answer" ? "mt-3" : undefined}>
          {renderPart(part, ctx)}
        </div>
      ))}

      {turn.status === "error" && (
        <InlineAlert tone="error" title="This turn failed">
          {turn.errorMessage ?? "The engine reported an error."}
        </InlineAlert>
      )}

      {turn.status === "complete" && <TurnSummaryLine turn={turn} />}
    </article>
  );
});
