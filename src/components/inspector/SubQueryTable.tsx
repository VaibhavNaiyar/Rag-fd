"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCount, formatScore } from "@/lib/format";
import type { TraceRecord, TraceSubQuery } from "@/types/trace";

const COLUMNS: readonly Column<TraceSubQuery>[] = [
  { id: "id", header: "Id", cell: (s) => s.id, mono: true, priority: 2 },
  { id: "text", header: "Query", cell: (s) => s.text, priority: 1 },
  {
    id: "source",
    header: "Source",
    cell: (s) => <Badge tone={s.source === "decomposed" ? "accent" : "neutral"}>{s.source}</Badge>,
    priority: 1,
  },
  { id: "confidence", header: "Confidence", cell: (s) => (s.confidence === undefined ? "—" : formatScore(s.confidence)), mono: true, align: "end", priority: 2 },
  { id: "reused", header: "Reuses", cell: (s) => s.reused_from ?? s.refines ?? "—", mono: true, priority: 2 },
];

/** Sub-queries with their span, confidence and lineage (P7-F07, replaces `SubQueryList`), plus the decomposition method and how many readings were merged or capped. */
export function SubQueryTable({ record }: { record: TraceRecord }) {
  if (record.sub_queries.length === 0) {
    return (
      <EmptyState title="No decomposition" level={4}>
        The controller never committed to a search on this turn.
      </EmptyState>
    );
  }

  const decomposition = record.decomposition;

  return (
    <div className="space-y-2">
      {decomposition && (
        <p className="text-caption text-ink-muted">
          method <span className="font-mono text-ink">{decomposition.method ?? "—"}</span>
          {decomposition.merged !== undefined && <> · {formatCount(decomposition.merged)} merged</>}
          {decomposition.capped !== undefined && decomposition.capped > 0 && <> · {formatCount(decomposition.capped)} capped</>}
        </p>
      )}
      <DataTable columns={COLUMNS} rows={record.sub_queries} getRowId={(s) => s.id} caption="Sub-queries" density="compact" />
    </div>
  );
}
