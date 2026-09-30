"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { formatScore } from "@/lib/format";
import type { Hit } from "@/types/events";
import type { TraceRecord } from "@/types/trace";

const BRANCH_LABELS: Record<string, string> = { bm25: "BM25", dense: "Dense" };

interface EvidenceRow {
  chunkId: string;
  /** Full text/source, when the live turn's `evidence` (a `Hit[]`, never trimmed of source fields) has this chunk. Trace-only records carry no chunk text (`e2e/fixtures/README.md`). */
  hit: Hit | null;
  score: number;
  branches: string[];
  subQueryId: string;
  /** Position among this sub-query's own kept results, before fusion. */
  originalRank: number;
  /** Position in the fused, final order — null if fusion dropped it. */
  finalRank: number | null;
  flagged: boolean;
}

function buildRows(record: TraceRecord, liveEvidence: readonly Hit[]): EvidenceRow[] {
  const liveById = new Map(liveEvidence.map((hit) => [hit.chunkId, hit]));
  const finalOrder = new Map(record.fusion?.chunk_ids.map((id, index) => [id, index]) ?? []);
  const flagged = new Set(record.fusion?.flagged_chunk_ids ?? []);
  const rows = new Map<string, EvidenceRow>();

  for (const result of record.retrieval) {
    result.kept.forEach((kept, index) => {
      const existing = rows.get(kept.chunk_id);
      if (existing && existing.score >= kept.score) return; // keep the best-scoring occurrence
      rows.set(kept.chunk_id, {
        chunkId: kept.chunk_id,
        hit: liveById.get(kept.chunk_id) ?? null,
        score: kept.score,
        branches: kept.branches,
        subQueryId: result.sub_query_id,
        originalRank: index + 1,
        finalRank: finalOrder.has(kept.chunk_id) ? finalOrder.get(kept.chunk_id)! + 1 : null,
        flagged: flagged.has(kept.chunk_id),
      });
    });
  }

  return [...rows.values()].sort((a, b) => (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity) || b.score - a.score);
}

const COLUMNS: readonly Column<EvidenceRow>[] = [
  { id: "chunk", header: "Chunk", cell: (r) => (r.hit ? `${r.hit.docId} §${r.hit.section}` : r.chunkId), mono: true, priority: 1 },
  { id: "score", header: "Score", cell: (r) => formatScore(r.score), mono: true, align: "end", sortable: true, sortValue: (r) => r.score, priority: 1 },
  {
    id: "branch",
    header: "Branch",
    cell: (r) => r.branches.map((b) => BRANCH_LABELS[b] ?? b).join(", "),
    priority: 2,
  },
  {
    id: "rank",
    header: "Rank Δ",
    cell: (r) => {
      if (r.finalRank === null) return "dropped";
      const delta = r.originalRank - r.finalRank;
      return delta === 0 ? "unchanged" : delta > 0 ? `+${delta}` : String(delta);
    },
    mono: true,
    align: "end",
    priority: 2,
  },
  {
    id: "status",
    header: "Status",
    cell: (r) => (
      <div className="flex flex-wrap gap-1">
        <Badge tone={r.finalRank === null ? "neutral" : "ok"}>{r.finalRank === null ? "dropped" : "kept"}</Badge>
        {r.flagged && <Badge tone="warn">flagged</Badge>}
      </div>
    ),
    priority: 1,
  },
];

/**
 * Every retrieved chunk (P7-F08, replaces `EvidenceCard`/`EvidenceList`): score,
 * branch, whether fusion kept or dropped it, its rank change, and whether it was
 * flagged as instruction-like text. A row expands to the quoted text when the
 * live turn has it — a trace-only record carries no chunk text at all, and this
 * says so rather than showing an empty cell.
 */
export function EvidenceTable({ record, liveEvidence = [] }: { record: TraceRecord; liveEvidence?: readonly Hit[] }) {
  const rows = useMemo(() => buildRows(record, liveEvidence), [record, liveEvidence]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) {
    return (
      <EmptyState title="No evidence" level={4}>
        No chunks were retrieved for this turn.
      </EmptyState>
    );
  }

  const expanded = rows.find((r) => r.chunkId === expandedId) ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {record.fusion?.quota_applied && (
          <Badge tone="accent" tooltip="A per-sub-query quota guarantees every intent a minimum share of the fused context — it does not cap any of them.">
            per-sub-query quota
          </Badge>
        )}
        {record.fusion && !record.fusion.full_corpus_search && <Badge tone="ok">no full-corpus search</Badge>}
      </div>
      {rows.some((r) => r.hit === null) && (
        <InlineAlert tone="info">Chunk text is only available for turns still live in this session — a fetched trace record carries ids and scores, not source text.</InlineAlert>
      )}
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowId={(r) => r.chunkId}
        caption="Evidence"
        density="compact"
        emptyMessage="No evidence"
        activeId={expandedId}
        onRowActivate={(r) => setExpandedId((current) => (current === r.chunkId ? null : r.chunkId))}
      />
      {expanded && (
        <div className="rounded-2 border border-line bg-surface-2 p-3">
          <p className="mb-1 font-mono text-caption text-ink-muted">{expanded.hit ? `${expanded.hit.docId} §${expanded.hit.section} · ${expanded.chunkId}` : expanded.chunkId}</p>
          <p className="min-w-0 break-words text-caption text-ink-body">{expanded.hit ? expanded.hit.text : "No text available — this chunk was fetched from the trace record, which does not carry source text."}</p>
        </div>
      )}
    </div>
  );
}
