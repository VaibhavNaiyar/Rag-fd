"use client";

import { KeyValueGrid } from "@/components/ui/KeyValueGrid";
import { MetricCell } from "@/components/ui/MetricCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCount, formatMs } from "@/lib/format";
import { reasonLabel } from "@/lib/labels";
import type { SpanNode } from "@/lib/trace/spans";

/** Every signal key a decision might carry — always present, or present only when that controller path computed it (P7-F05). Anything else in `signals` (there is nothing else, by the schema) would fall through silently, which is the point: this list is exhaustive against `types/trace.ts`'s `signalsSchema`. */
const SIGNAL_ROWS: { key: string; label: string }[] = [
  { key: "cos_prev", label: "Stability (cos, prev)" },
  { key: "stable_run", label: "Stable run" },
  { key: "ms", label: "Decision latency" },
  { key: "boundary", label: "Clause boundary" },
  { key: "cos_trigger", label: "Drift from trigger" },
];

/** One span's or marker's detail (P7-F05): its window, its own detail rows, and — for the `listen` span, which carries every decision as a marker — each decision's signals, with `—` for whichever the controller path did not compute. */
export function SpanDetail({ span }: { span: SpanNode | null }) {
  if (!span) {
    return (
      <EmptyState title="Nothing selected" level={4}>
        Select a span or a search in the tree or the waterfall.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-label font-semibold text-ink">{span.label}</p>
        <p className="text-caption text-ink-muted">
          {span.startMs === null || span.endMs === null ? "timing unavailable" : `${formatMs(span.startMs)} – ${formatMs(span.endMs)} (${span.provenance})`}
        </p>
        {span.cancelled && <p className="text-caption text-warn-ink">cancelled: {span.cancelReason ? reasonLabel(span.cancelReason) : "—"}</p>}
      </div>

      {span.details.length > 0 && (
        <KeyValueGrid label={`${span.label} detail`}>
          {span.details.map((detail) => (
            <MetricCell key={detail.label} label={detail.label} value={detail.value} provenance="measured" />
          ))}
        </KeyValueGrid>
      )}

      {span.markers.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption font-semibold text-ink-muted">Decisions ({formatCount(span.markers.length)})</p>
          {span.markers.map((marker) => {
            if (marker.kind !== "decision") {
              return (
                <p key={marker.id} className="text-caption text-ink-body">
                  first token at {formatMs(marker.atMs)}
                </p>
              );
            }
            return (
              <div key={marker.id} className="rounded-2 border border-line p-2">
                <p className="mb-1 text-caption">
                  <span className="font-medium text-ink-body">{marker.decision}</span> · {reasonLabel(marker.reason)} · {formatMs(marker.atMs)} · confidence {marker.confidence.toFixed(2)}
                </p>
                <KeyValueGrid label="Signals" columns={2}>
                  {SIGNAL_ROWS.map(({ key, label }) => (
                    <MetricCell key={key} label={label} value={key in marker.signals ? String((marker.signals as Record<string, unknown>)[key]) : null} provenance={key in marker.signals ? "measured" : "unavailable"} />
                  ))}
                </KeyValueGrid>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
