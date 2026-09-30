"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DataTable, sortRows, type Column, type SortState } from "@/components/ui/DataTable";
import { Histogram } from "@/components/ui/Histogram";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { KeyValueGrid } from "@/components/ui/KeyValueGrid";
import { MetricCell } from "@/components/ui/MetricCell";
import { Panel } from "@/components/ui/Panel";
import { Sparkline } from "@/components/ui/Sparkline";
import { ThresholdMeter } from "@/components/ui/ThresholdMeter";
import { KIT_CODE, KIT_DISTRIBUTION, KIT_RECORD, KIT_SERIES, KIT_TURNS, type KitTurn } from "./kitData";
import { Group, Section } from "./Section";

/** Eight columns, in three priorities: the acceptance case for 375 px. */
const COLUMNS: Column<KitTurn>[] = [
  { id: "id", header: "Turn", cell: (row) => row.id, mono: true, width: "3.5rem", sortable: true, sortValue: (row) => row.id },
  { id: "utterance", header: "Utterance", cell: (row) => row.utterance },
  { id: "status", header: "Status", cell: (row) => <Badge tone={row.status === "error" ? "error" : row.status === "streaming" ? "accent" : "ok"}>{row.status}</Badge>, width: "6.5rem" },
  { id: "ttft", header: "TTFT", cell: (row) => (row.ttft === null ? "—" : `${row.ttft} ms`), mono: true, align: "end", width: "5.5rem", sortable: true, sortValue: (row) => row.ttft },
  { id: "lead", header: "Lead", cell: (row) => (row.lead === null ? "—" : `${row.lead} ms`), mono: true, align: "end", width: "5.5rem", priority: 2 },
  { id: "cost", header: "Cost", cell: (row) => row.cost, mono: true, align: "end", width: "5rem", priority: 2 },
  { id: "support", header: "Support", cell: (row) => row.support, mono: true, align: "end", width: "5rem", priority: 3 },
  { id: "session", header: "Session", cell: (row) => row.session, mono: true, width: "8rem", priority: 3 },
];

const getRowId = (row: KitTurn) => row.id;

export function DataSections() {
  const [sort, setSort] = useState<SortState | null>(null);
  const [activeId, setActiveId] = useState<string | null>("t3");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(["t2"]));
  const rows = sortRows(KIT_TURNS, COLUMNS, sort);

  return (
    <>
      <Section id="table" title="Data table" note="Eight columns. It adapts to its own width: columns drop out by priority, and under 480 px each row is a record.">
        <Panel title="Turns" count={rows.length} variant="boxed" padded={false}>
          <DataTable
            caption="Turns"
            columns={COLUMNS}
            rows={rows}
            getRowId={getRowId}
            sort={sort}
            onSortChange={setSort}
            activeId={activeId}
            onRowActivate={(row) => setActiveId(row.id)}
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            rowLabel={(row) => `Select turn ${row.id}`}
          />
        </Panel>
        <Group title="Compact density, no interaction">
          <Panel title="Compact" variant="boxed" padded={false}>
            <DataTable caption="Turns, compact" columns={COLUMNS.slice(0, 4)} rows={KIT_TURNS.slice(0, 3)} getRowId={getRowId} density="compact" />
          </Panel>
        </Group>
        <Group title="Empty and loading">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <Panel title="Empty" padded={false}>
              <DataTable caption="Empty turns" columns={COLUMNS.slice(0, 3)} rows={[]} getRowId={getRowId} emptyMessage="No turns yet." />
            </Panel>
            <Panel title="Loading" padded={false}>
              <DataTable caption="Loading turns" columns={COLUMNS.slice(0, 3)} rows={[]} getRowId={getRowId} loading />
            </Panel>
          </div>
        </Group>
      </Section>

      <Section id="metrics" title="Readouts, meters and charts" note="Every number says where it came from. Every chart has a table alternative for assistive technology.">
        <KeyValueGrid label="Turn t3 timings">
          <MetricCell label="TTFT" value="1,240" unit="ms" hint="from utterance end" provenance="measured" />
          <MetricCell label="Lead" value="620" unit="ms" tone="ok" provenance="measured" />
          <MetricCell label="Complete" value="2,810" unit="ms" provenance="measured" />
          <MetricCell label="Plan start" value="430" unit="ms" provenance="modelled" />
          <MetricCell label="Cost" value={null} />
          <MetricCell label="Session id" value="s_kit_0001" tone="accent" />
        </KeyValueGrid>
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
          <ThresholdMeter label="Time to first token" value={640} target={800} direction="atMost" unit=" ms" provenance="measured" />
          <ThresholdMeter label="Time to first token, slow turn" value={1240} target={800} direction="atMost" unit=" ms" provenance="measured" />
          <ThresholdMeter label="Citation support" value={0.92} target={0.85} direction="atLeast" format={(value) => `${Math.round(value * 100)}`} unit="%" />
          <ThresholdMeter label="Retrieval lead" value={null} target={500} direction="atLeast" unit=" ms" />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
          <Sparkline label="TTFT by turn" values={KIT_SERIES} pointLabels={KIT_SERIES.map((_, index) => `t${index + 1}`)} unit=" ms" provenance="measured" />
          <Histogram label="TTFT distribution" values={KIT_DISTRIBUTION} bins={6} unit=" ms" provenance="measured" />
        </div>
      </Section>

      <Section id="code" title="JSON and code" note="Long strings wrap. Nothing scrolls sideways.">
        <JsonViewer label="Trace record t3" value={KIT_RECORD} defaultExpandDepth={2} />
        <CodeBlock code={KIT_CODE} language="pipeline" label="Pipeline steps" />
      </Section>
    </>
  );
}
