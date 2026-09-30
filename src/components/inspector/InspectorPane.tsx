"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerDiff } from "@/components/inspector/AnswerDiff";
import { AnswerPanel } from "@/components/inspector/AnswerPanel";
import { ControllerLog } from "@/components/inspector/ControllerLog";
import { CostPanel } from "@/components/inspector/CostPanel";
import { DegradedBanner } from "@/components/inspector/DegradedBanner";
import { EvidenceTable } from "@/components/inspector/EvidenceTable";
import { GroundingPanel } from "@/components/inspector/GroundingPanel";
import { InspectorFind } from "@/components/inspector/InspectorFind";
import { InspectorHeader } from "@/components/inspector/InspectorHeader";
import { RawPanel } from "@/components/inspector/RawPanel";
import { SpanDetail } from "@/components/inspector/SpanDetail";
import { SpanTree } from "@/components/inspector/SpanTree";
import { SpeculationPanel } from "@/components/inspector/SpeculationPanel";
import { SubQueryTable } from "@/components/inspector/SubQueryTable";
import { Waterfall } from "@/components/inspector/Waterfall";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { diffFromTrace, diffLiveVersions } from "@/lib/trace/diff";
import { buildSpanTree, flattenSpans } from "@/lib/trace/spans";
import { selectMergedTurn } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

export interface InspectorPaneProps {
  sessionId: string;
  turnId: string;
}

type Lens = "spans" | "transcript" | "timeline";
type DetailTab = "subqueries" | "evidence" | "cost" | "grounding" | "speculation" | "raw";

const LENS_ITEMS = [
  { id: "spans", label: "Spans" },
  { id: "transcript", label: "Transcript" },
  { id: "timeline", label: "Timeline" },
];

const DETAIL_ITEMS: { id: DetailTab; label: string }[] = [
  { id: "subqueries", label: "Sub-queries" },
  { id: "evidence", label: "Evidence" },
  { id: "cost", label: "Cost" },
  { id: "grounding", label: "Grounding" },
  { id: "speculation", label: "Speculation" },
  { id: "raw", label: "Raw" },
];

/**
 * The Trace Inspector (P7-F01): a lens switch (Spans / Transcript / Timeline)
 * over the turn's `/trace` record, plus a second tab strip for the detail
 * panels that do not fit any one lens. Loading, missing (the ring evicted it,
 * or the engine restarted) and error each have their own state; `[`/`]` move
 * to the previous or next turn in this session.
 */
export function InspectorPane({ sessionId, turnId }: InspectorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const turns = useAppStore((state) => state.turns);
  const traces = useAppStore((state) => state.traces);
  const ensureTrace = useAppStore((state) => state.ensureTrace);
  const invalidateTrace = useAppStore((state) => state.invalidateTrace);
  const selectTurn = useAppStore((state) => state.selectTurn);

  const merged = selectMergedTurn(turns, traces, sessionId, turnId);
  const [lens, setLens] = useState<Lens>("spans");
  const [detailTab, setDetailTab] = useState<DetailTab>("subqueries");
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [answerVersion, setAnswerVersion] = useState<number | null>(null);

  // Resetting per-turn selection when the turn changes (react.dev's "adjusting state when a prop
  // changes" pattern): setting state during render, guarded by comparing against the last turn
  // this render saw, rather than an effect that would run one paint late.
  const turnKey = `${sessionId}:${turnId}`;
  const [renderedForTurn, setRenderedForTurn] = useState(turnKey);
  if (renderedForTurn !== turnKey) {
    setRenderedForTurn(turnKey);
    setSelectedSpanId(null);
    setAnswerVersion(null);
  }

  useEffect(() => {
    ensureTrace(sessionId, turnId);
  }, [sessionId, turnId, ensureTrace]);

  const sessionTurns = useMemo(() => turns.filter((t) => t.sessionId === sessionId), [turns, sessionId]);
  const turnIndex = sessionTurns.findIndex((t) => t.id === turnId);
  const goTo = useCallback(
    (index: number) => {
      const target = sessionTurns[index];
      if (target) selectTurn({ sessionId, turnId: target.id });
    },
    [sessionTurns, selectTurn, sessionId],
  );
  const onPrevious = turnIndex > 0 ? () => goTo(turnIndex - 1) : null;
  const onNext = turnIndex !== -1 && turnIndex < sessionTurns.length - 1 ? () => goTo(turnIndex + 1) : null;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
      if (event.key === "[") goTo(turnIndex - 1);
      else if (event.key === "]") goTo(turnIndex + 1);
    };
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [goTo, turnIndex]);

  const record = merged.trace;
  const liveTurn = merged.live;
  const tree = record ? buildSpanTree(record) : null;
  const selectedSpan = tree && selectedSpanId ? (flattenSpans(tree).find((s) => s.id === selectedSpanId) ?? null) : null;

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}#/inspect/${encodeURIComponent(sessionId)}/${encodeURIComponent(turnId)}`;

  if (merged.traceStatus === "error" && !record) {
    return (
      <div className="p-3">
        <InlineAlert
          tone="error"
          title="Could not load this turn's trace"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                invalidateTrace(sessionId, turnId);
                ensureTrace(sessionId, turnId);
              }}
            >
              Retry
            </Button>
          }
        >
          {traces[`${sessionId}:${turnId}`]?.error ?? "Unknown error."}
        </InlineAlert>
      </div>
    );
  }

  if (merged.traceStatus === "missing" && !liveTurn) {
    return (
      <div className="p-3">
        <EmptyState title="Trace evicted">This turn has fallen out of the engine&rsquo;s trace ring (it holds 500 records) and the engine may have restarted since. Nothing else is known about it.</EmptyState>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center gap-2 p-3">
        <Spinner label="Loading trace" size="sm" />
        <span className="text-caption text-ink-muted">Loading this turn&rsquo;s trace…</span>
      </div>
    );
  }

  const activeVersion = answerVersion ?? record.answer?.version ?? null;
  const liveVersions = liveTurn?.versions ?? [];
  const currentLive = liveVersions.find((v) => v.version === activeVersion) ?? null;
  const parentLive = currentLive?.parent !== null && currentLive?.parent !== undefined ? liveVersions.find((v) => v.version === currentLive.parent) : undefined;
  const diff = currentLive && parentLive ? diffLiveVersions(parentLive, currentLive) : record.refinement ? diffFromTrace(record) : null;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col outline-none" tabIndex={-1}>
      <DegradedBanner record={record} />
      <InspectorHeader record={record} onPrevious={onPrevious} onNext={onNext} shareUrl={shareUrl} />

      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <Tabs label="Lens" items={LENS_ITEMS} value={lens} onValueChange={(v) => setLens(v as Lens)} idPrefix="lens" />
        <InspectorFind containerRef={containerRef} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabPanel idPrefix="lens" tabId="spans" active={lens === "spans"} className="space-y-4 p-3">
          {tree && (
            <>
              <Waterfall tree={tree} utteranceEndMs={record.utterance_end_ms} firstRetrievalMs={record.first_retrieval_ms} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />
              <SpanTree root={tree} selectedId={selectedSpanId} onSelect={(span) => setSelectedSpanId(span.id)} />
              <SpanDetail span={selectedSpan} />
            </>
          )}
        </TabPanel>

        <TabPanel idPrefix="lens" tabId="transcript" active={lens === "transcript"} className="space-y-4 p-3">
          <AnswerPanel record={record} liveEvidence={liveTurn?.evidence} version={activeVersion} onVersionChange={setAnswerVersion} />
          {diff && <AnswerDiff diff={diff} />}
        </TabPanel>

        <TabPanel idPrefix="lens" tabId="timeline" active={lens === "timeline"} className="p-3">
          <ControllerLog decisions={record.decisions} />
        </TabPanel>
      </div>

      <Tabs label="Detail" variant="segmented" items={DETAIL_ITEMS} value={detailTab} onValueChange={(v) => setDetailTab(v as DetailTab)} idPrefix="detail" className="border-t border-line px-3 py-1.5" />
      <div className="max-h-64 overflow-y-auto border-t border-line p-3">
        <TabPanel idPrefix="detail" tabId="subqueries" active={detailTab === "subqueries"}>
          <SubQueryTable record={record} />
        </TabPanel>
        <TabPanel idPrefix="detail" tabId="evidence" active={detailTab === "evidence"}>
          <EvidenceTable record={record} liveEvidence={liveTurn?.evidence} />
        </TabPanel>
        <TabPanel idPrefix="detail" tabId="cost" active={detailTab === "cost"}>
          <CostPanel cost={record.cost} />
        </TabPanel>
        <TabPanel idPrefix="detail" tabId="grounding" active={detailTab === "grounding"}>
          <GroundingPanel record={record} />
        </TabPanel>
        <TabPanel idPrefix="detail" tabId="speculation" active={detailTab === "speculation"}>
          <SpeculationPanel record={record} />
        </TabPanel>
        <TabPanel idPrefix="detail" tabId="raw" active={detailTab === "raw"}>
          <RawPanel record={record} />
        </TabPanel>
      </div>
    </div>
  );
}
