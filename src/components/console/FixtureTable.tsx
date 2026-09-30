"use client";

import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, sortRows, type Column, type SortState } from "@/components/ui/DataTable";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { FIXTURE_FAMILIES } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import type { FixtureInfo } from "@/types/events";

const FAMILY_LABEL = new Map(FIXTURE_FAMILIES.map((entry) => [entry.family, entry.label]));

function wordCount(fixture: FixtureInfo): number {
  return fixture.turns.reduce((sum, turn) => sum + turn.split(/\s+/).filter(Boolean).length, 0);
}

/** Columns that do not need the `replayFixture` action — `run` is added by the component, which has it. */
const DATA_COLUMNS: readonly Column<FixtureInfo>[] = [
  { id: "id", header: "Fixture", cell: (f) => f.id, mono: true, sortable: true, sortValue: (f) => f.id, priority: 1 },
  { id: "family", header: "Scenario", cell: (f) => FAMILY_LABEL.get(f.family) ?? f.family, sortable: true, sortValue: (f) => f.family, priority: 1 },
  { id: "words", header: "Words", cell: (f) => String(wordCount(f)), mono: true, align: "end", sortable: true, sortValue: (f) => wordCount(f), priority: 2 },
  { id: "turns", header: "Turns", cell: (f) => String(f.turns.length), mono: true, align: "end", sortable: true, sortValue: (f) => f.turns.length, priority: 2 },
  { id: "description", header: "Exercises", cell: (f) => f.description, priority: 1 },
];

export interface FixtureTableProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every replayable test case the engine serves for its corpus (P6-F13,
 * replaces `FixtureBrowser`): a `DataTable` in a `Sheet`, filterable, each row
 * runnable. This is how a tester walks the eval set by hand — a click replays
 * the case through the exact path the harness scores.
 */
export function FixtureTable({ open, onOpenChange }: FixtureTableProps) {
  const fixtures = useAppStore((state) => state.fixtures);
  const replayFixture = useAppStore((state) => state.replayFixture);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = !needle
      ? fixtures
      : fixtures.filter((f) => f.id.toLowerCase().includes(needle) || f.turns.some((t) => t.toLowerCase().includes(needle)) || f.description.toLowerCase().includes(needle));
    return sortRows(matches, DATA_COLUMNS, sort);
  }, [fixtures, query, sort]);

  const columns = useMemo<readonly Column<FixtureInfo>[]>(
    () => [
      ...DATA_COLUMNS,
      {
        id: "run",
        header: "Run",
        align: "end",
        priority: 1,
        cell: (fixture: FixtureInfo) => <IconButton label={`Run ${fixture.id}`} size="sm" icon={<Play size={13} aria-hidden />} onClick={() => replayFixture(fixture.id)} />,
      },
    ],
    [replayFixture],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Test cases" description={`${fixtures.length} fixtures for this corpus`} side="right">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <Input type="search" placeholder="Filter by id, wording or what it exercises…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Filter test cases" />
        <div className="min-h-0 flex-1 overflow-hidden">
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={(f) => f.id}
            caption="Test cases"
            sort={sort}
            onSortChange={setSort}
            onRowActivate={(f) => replayFixture(f.id)}
            emptyMessage="No test case matches."
          />
        </div>
      </div>
    </Sheet>
  );
}
