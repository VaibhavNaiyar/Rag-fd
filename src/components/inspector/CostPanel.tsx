"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { KeyValueGrid } from "@/components/ui/KeyValueGrid";
import { MetricCell } from "@/components/ui/MetricCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { EMPTY, formatCount, formatMs, formatUsd } from "@/lib/format";
import type { TraceCost } from "@/types/trace";

interface EntryRow {
  id: string;
  step: string;
  kind: string;
  model: string;
  ms: number | null;
  usd: number | null;
}

const COLUMNS: readonly Column<EntryRow>[] = [
  { id: "step", header: "Step", cell: (r) => r.step || EMPTY, sortable: true, sortValue: (r) => r.step, priority: 1 },
  { id: "kind", header: "Kind", cell: (r) => r.kind || EMPTY, priority: 2 },
  { id: "model", header: "Model", cell: (r) => r.model || EMPTY, mono: true, priority: 1 },
  { id: "ms", header: "Latency", cell: (r) => formatMs(r.ms), mono: true, align: "end", sortable: true, sortValue: (r) => r.ms, priority: 2 },
  { id: "usd", header: "Cost", cell: (r) => formatUsd(r.usd), mono: true, align: "end", sortable: true, sortValue: (r) => r.usd, priority: 1 },
];

/** `cost.entries[]` by step and model (P7-F10): every dollar this turn spent, never a rollup with no rows behind it. */
export function CostPanel({ cost }: { cost: TraceCost | null }) {
  if (!cost || cost.entries.length === 0) {
    return (
      <EmptyState title="No cost entries" level={4}>
        {cost ? `The turn cost ${formatUsd(cost.turnUsd)}, but no per-step entries were recorded.` : "No cost record for this turn."}
      </EmptyState>
    );
  }

  const rows: EntryRow[] = cost.entries.map((entry, index) => ({
    id: `${entry.step ?? "entry"}-${index}`,
    step: entry.step ?? "",
    kind: entry.kind ?? "",
    model: entry.model ?? "",
    ms: entry.ms ?? null,
    usd: entry.usd ?? null,
  }));
  const entrySum = cost.entries.reduce((sum, entry) => sum + (entry.usd ?? 0), 0);
  const reconciles = Math.abs(entrySum - cost.turnUsd) < 0.000005;

  return (
    <div className="space-y-3">
      <KeyValueGrid label="Turn cost">
        <MetricCell label="Total" value={formatUsd(cost.turnUsd)} provenance="measured" />
        <MetricCell label="Tokens" value={formatCount(cost.turnTokens)} provenance="measured" />
        <MetricCell label="Entries sum" value={formatUsd(entrySum)} tone={reconciles ? "ok" : "error"} hint={reconciles ? "reconciles with the total" : "does not reconcile with the total"} provenance="measured" />
      </KeyValueGrid>

      <DataTable columns={COLUMNS} rows={rows} getRowId={(r) => r.id} caption="Cost by step and model" density="compact" />

      {cost.models.length > 0 && (
        <KeyValueGrid label="Tokens by model">
          {cost.models.map((model) => (
            <MetricCell key={model.model} label={model.model} value={`${formatCount(model.inputTokens)} in / ${formatCount(model.outputTokens)} out`} provenance="measured" />
          ))}
        </KeyValueGrid>
      )}
    </div>
  );
}
