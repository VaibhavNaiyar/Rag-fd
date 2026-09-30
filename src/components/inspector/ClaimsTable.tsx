"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCount, formatRate } from "@/lib/format";
import type { TraceClaim } from "@/types/trace";

const COLUMNS: readonly Column<TraceClaim>[] = [
  { id: "text", header: "Claim", cell: (c) => c.text, priority: 1 },
  { id: "support", header: "Support", cell: (c) => formatRate(c.support), mono: true, align: "end", sortable: true, sortValue: (c) => c.support, priority: 1 },
  { id: "chunks", header: "Chunks", cell: (c) => formatCount(c.chunkIds.length), mono: true, align: "end", priority: 2 },
  { id: "subQuery", header: "Sub-query", cell: (c) => c.subQueryId, mono: true, priority: 3 },
];

/** Every factual claim the answer makes, with its verifier support score (P7-F09). */
export function ClaimsTable({ claims }: { claims: readonly TraceClaim[] }) {
  if (claims.length === 0) {
    return (
      <EmptyState title="No claims" level={4}>
        This answer version produced no factual claims to verify.
      </EmptyState>
    );
  }

  return <DataTable columns={COLUMNS} rows={claims} getRowId={(c) => c.id} caption="Claims" density="compact" />;
}
