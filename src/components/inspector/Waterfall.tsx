"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartTable } from "@/components/ui/ChartTable";
import { IconButton } from "@/components/ui/IconButton";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { cn } from "@/lib/cn";
import { formatLead, formatMs } from "@/lib/format";
import type { SpanNode } from "@/lib/trace/spans";
import {
  axisTicks,
  buildWaterfallRows,
  clampZoom,
  domainOf,
  leadVector,
  stackedRows,
  utteranceEndRule,
  type ZoomWindow,
} from "@/lib/trace/waterfall";

const STACKED_BELOW = 520;

export interface WaterfallProps {
  tree: SpanNode;
  utteranceEndMs: number | null;
  firstRetrievalMs: number | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * The trace waterfall (P7-F04): one lane per named span, one bar per search
 * under Retrieve, the utterance-end rule and the lead vector drawn across
 * every lane, a nice-number axis, and a zoom window over the same domain the
 * rows are laid out on. Below 520 px there is no room for a shared axis, so
 * it falls back to the stacked layout (`stackedRows`) — proportional widths,
 * no shared offset. The numeric table alternative is always in the DOM.
 */
export function Waterfall({ tree, utteranceEndMs, firstRetrievalMs, selectedId, onSelect }: WaterfallProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>({ fallback: 600 });
  const full = useMemo(() => domainOf(tree), [tree]);
  const [zoom, setZoom] = useState<ZoomWindow>(full);
  const [showTable, setShowTable] = useState(false);
  const domain = zoom.startMs === full.startMs && zoom.endMs === full.endMs ? full : clampZoom(zoom, full);

  const stacked = width < STACKED_BELOW;
  const stackedRowData = useMemo(() => stackedRows(tree, domain), [tree, domain]);
  const waterfallRowData = useMemo(() => buildWaterfallRows(tree, domain), [tree, domain]);
  const ticks = useMemo(() => axisTicks(domain), [domain]);
  const endRule = useMemo(() => utteranceEndRule(utteranceEndMs, domain), [utteranceEndMs, domain]);
  const lead = useMemo(() => leadVector(utteranceEndMs, firstRetrievalMs, domain), [utteranceEndMs, firstRetrievalMs, domain]);

  const zoomIn = () => {
    const span = domain.endMs - domain.startMs;
    const center = (domain.startMs + domain.endMs) / 2;
    setZoom(clampZoom({ startMs: center - span / 4, endMs: center + span / 4 }, full));
  };
  const zoomOut = () => {
    const span = domain.endMs - domain.startMs;
    const center = (domain.startMs + domain.endMs) / 2;
    setZoom(clampZoom({ startMs: center - span, endMs: center + span }, full));
  };
  const resetZoom = () => setZoom(full);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-ink-muted">{stacked ? "Stacked (narrow view) — durations are proportional, not aligned to a shared axis." : "Measured, except Plan (duration measured, start modelled)."}</p>
        {!stacked && (
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="Zoom in" size="sm" icon={<ZoomIn size={14} aria-hidden />} onClick={zoomIn} />
            <IconButton label="Zoom out" size="sm" icon={<ZoomOut size={14} aria-hidden />} onClick={zoomOut} />
            {(domain.startMs !== full.startMs || domain.endMs !== full.endMs) && (
              <button type="button" onClick={resetZoom} className="text-caption text-accent-ink underline">
                Reset zoom
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={ref} className="relative min-w-0">
        {!stacked && (
          <div className="relative mb-1 h-4">
            {ticks.map((tick) => (
              <span key={tick.ms} className="absolute -translate-x-1/2 font-mono text-caption text-ink-muted" style={{ left: `${tick.xPct}%` }}>
                {tick.label}
              </span>
            ))}
          </div>
        )}

        <div className="relative space-y-1">
          {!stacked && endRule && (
            <div aria-hidden className="absolute inset-y-0 z-10 w-px bg-ink" style={{ left: `${endRule.xPct}%` }} />
          )}
          {!stacked && lead && lead.direction === "before" && (
            <div
              aria-hidden
              className="absolute top-0 h-0.5 bg-accent"
              style={{ left: `${Math.min(lead.fromXPct, lead.toXPct)}%`, width: `${Math.abs(lead.toXPct - lead.fromXPct)}%` }}
              title={`${formatLead(lead.leadMs)} lead`}
            />
          )}

          {stacked
            ? stackedRowData.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "flex min-h-hit w-full min-w-0 items-center gap-2 rounded-1 px-2 py-1 text-left",
                    selectedId === row.id ? "bg-accent-soft" : "hover:bg-surface-2",
                  )}
                  style={{ marginLeft: row.depth > 1 ? "16px" : undefined }}
                >
                  <span className="min-w-0 flex-1 truncate text-caption text-ink-body">{row.label}</span>
                  <span className="h-2 shrink-0 rounded-1" style={{ width: `${Math.max(2, row.widthPct ?? 0)}%`, minWidth: row.widthPct === null ? 0 : "4px", background: row.colorVar, opacity: row.cancelled ? 0.4 : 1 }} />
                  <span className="shrink-0 font-mono text-caption tabular text-ink-muted">{formatMs(row.durationMs)}</span>
                </button>
              ))
            : waterfallRowData.map((row) => (
                <div key={row.id} className="relative flex min-w-0 items-center gap-2" style={{ paddingLeft: row.depth > 1 ? "12px" : undefined }}>
                  <span className="w-20 shrink-0 truncate text-caption text-ink-muted">{row.label}</span>
                  <span className="relative h-5 min-w-0 flex-1">
                    {row.geometry ? (
                      <button
                        type="button"
                        onClick={() => onSelect(row.id)}
                        aria-label={`${row.label}, ${row.cancelled ? "cancelled" : row.provenance}`}
                        className={cn(
                          "absolute top-0.5 h-4 min-w-1 rounded-1 outline-none",
                          selectedId === row.id && "ring-2 ring-accent",
                          row.cancelled && "border border-dashed border-warn bg-transparent",
                        )}
                        style={{ left: `${row.geometry.xPct}%`, width: `${Math.max(0.5, row.geometry.widthPct)}%`, background: row.cancelled ? undefined : row.colorVar }}
                      >
                        {row.cancelled && <span aria-hidden className="absolute -right-1 top-1/2 h-2 w-px -translate-y-1/2 rotate-45 bg-warn" />}
                      </button>
                    ) : (
                      <span className="text-caption text-ink-muted">unavailable</span>
                    )}
                    {row.markers.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => onSelect(row.id)}
                        aria-label={marker.marker.kind === "decision" ? `${marker.marker.decision} at ${formatMs(marker.marker.atMs)}` : `first token at ${formatMs(marker.marker.atMs)}`}
                        className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink outline-none"
                        style={{ left: `${marker.xPct}%` }}
                      />
                    ))}
                  </span>
                </div>
              ))}
        </div>
      </div>

      {lead && (
        <p className="text-caption text-ink-muted">
          Lead: {lead.direction === "before" ? `${formatLead(lead.leadMs)} before the utterance ended` : `${formatLead(lead.leadMs)} after the utterance ended`}
        </p>
      )}

      <button type="button" onClick={() => setShowTable((v) => !v)} className="text-caption text-accent-ink underline">
        {showTable ? "Hide" : "Show"} as a table
      </button>
      <ChartTable
        caption="Waterfall, as a table"
        columns={["Span", "Start", "End", "Provenance"]}
        rows={buildWaterfallRows(tree, full).map((row) => [row.label, row.geometry ? `${row.geometry.xPct.toFixed(1)}%` : "—", row.geometry ? `${(row.geometry.xPct + row.geometry.widthPct).toFixed(1)}%` : "—", row.cancelled ? "cancelled" : row.provenance])}
        visible={showTable}
      />
    </div>
  );
}
