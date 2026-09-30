"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export type SortDirection = "ascending" | "descending";

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface Column<T> {
  id: string;
  /** The column heading, and the label of each value when a row is shown as a record. */
  header: string;
  cell: (row: T) => ReactNode;
  /** 1 is always shown; 2 is hidden when the table is narrower than 720 px; 3 when it is narrower than 960 px. Default 1. */
  priority?: 1 | 2 | 3;
  align?: "start" | "end";
  /** Ids, times and counts read better in the monospace face. */
  mono?: boolean;
  /** A CSS width such as "6rem" or "20%". Columns without one share the rest. */
  width?: string;
  sortable?: boolean;
  /** What rows are ordered by, for sortRows. `null` sorts last in either direction. */
  sortValue?: (row: T) => string | number | null;
}

/** none, then ascending, then descending, then none again. */
export function nextSort(current: SortState | null | undefined, columnId: string): SortState | null {
  if (!current || current.columnId !== columnId) return { columnId, direction: "ascending" };
  return current.direction === "ascending" ? { columnId, direction: "descending" } : null;
}

/** A stable sort by a column's `sortValue`. Numbers compare as numbers, text with numeric awareness ("t2" before "t10"). */
export function sortRows<T>(rows: readonly T[], columns: readonly Column<T>[], sort: SortState | null | undefined): T[] {
  const sortValue = sort ? columns.find((column) => column.id === sort.columnId)?.sortValue : undefined;
  if (!sort || !sortValue) return [...rows];
  const direction = sort.direction === "ascending" ? 1 : -1;

  return rows
    .map((row, index) => ({ row, index, key: sortValue(row) }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      const order = typeof a.key === "number" && typeof b.key === "number" ? a.key - b.key : String(a.key).localeCompare(String(b.key), "en", { numeric: true });
      return order === 0 ? a.index - b.index : order * direction;
    })
    .map((entry) => entry.row);
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** The table's name. It is not drawn; assistive technology reads it. */
  caption: string;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** The row whose details are open elsewhere (the Inspector): marked `aria-current` and drawn selected. */
  activeId?: string | null;
  /** Enter, or a click, on a row. Makes the table a grid: one row is a tab stop and the arrow keys move between rows. */
  onRowActivate?: (row: T) => void;
  /** Adds a checkbox column. Space toggles the focused row. Give both props to turn it on. */
  selectedIds?: ReadonlySet<string>;
  onSelectedIdsChange?: (ids: ReadonlySet<string>) => void;
  /** The name of a row's checkbox. Default "Select {id}". */
  rowLabel?: (row: T) => string;
  /** 28 px rows or 36 px rows; both are 44 px on a touch screen. Default "default". */
  density?: "compact" | "default";
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const PAGE = 10;

/**
 * A data table that never scrolls sideways (PHASES.md R4). It is a real table with
 * headings, a sticky header, sortable columns (`aria-sort`) and, when rows can be
 * opened or selected, a keyboard grid: one tab stop, Up and Down between rows, Home,
 * End, Page Up and Page Down, Enter to open, Space to select.
 *
 * It adapts to its own width, not the window's (containers.css): columns drop out by
 * priority as it narrows, and under 480 px each row becomes a labelled record, one
 * value per line under its column name.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  sort,
  onSortChange,
  activeId,
  onRowActivate,
  selectedIds,
  onSelectedIdsChange,
  rowLabel,
  density = "default",
  loading = false,
  emptyMessage = "No rows to show.",
  className,
}: DataTableProps<T>) {
  const [focusId, setFocusId] = useState<string | null>(null);

  const selectable = selectedIds !== undefined && onSelectedIdsChange !== undefined;
  const interactive = onRowActivate !== undefined || selectable;
  const ids = rows.map(getRowId);
  const tabStop = focusId !== null && ids.includes(focusId) ? focusId : ids[0];
  const span = columns.length + (selectable ? 1 : 0);
  const chosen = selectedIds ? ids.filter((id) => selectedIds.has(id)).length : 0;

  const toggle = (id: string) => {
    if (!selectedIds || !onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  };

  const toggleAll = (on: boolean) => {
    if (!selectedIds || !onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onSelectedIdsChange(next);
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T, id: string) => {
    // Keys pressed inside a control in a cell (a checkbox, a button) belong to that control.
    if (event.target !== event.currentTarget) return;
    const siblings = Array.from(event.currentTarget.parentElement?.children ?? []) as HTMLElement[];
    const at = siblings.indexOf(event.currentTarget);
    let to: HTMLElement | undefined;

    switch (event.key) {
      case "ArrowDown":
        to = siblings[Math.min(at + 1, siblings.length - 1)];
        break;
      case "ArrowUp":
        to = siblings[Math.max(at - 1, 0)];
        break;
      case "PageDown":
        to = siblings[Math.min(at + PAGE, siblings.length - 1)];
        break;
      case "PageUp":
        to = siblings[Math.max(at - PAGE, 0)];
        break;
      case "Home":
        to = siblings[0];
        break;
      case "End":
        to = siblings[siblings.length - 1];
        break;
      case "Enter":
        event.preventDefault();
        onRowActivate?.(row);
        return;
      case " ":
        event.preventDefault();
        if (selectable) toggle(id);
        else onRowActivate?.(row);
        return;
      default:
        return;
    }
    event.preventDefault();
    to?.focus();
  };

  const onRowClick = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowActivate) return;
    if ((event.target as HTMLElement).closest("button, a, input, label, [role='checkbox']")) return;
    onRowActivate(row);
  };

  return (
    <div className={cn("dt", className)} data-density={density}>
      <table role={interactive ? "grid" : "table"} aria-multiselectable={selectable || undefined} aria-busy={loading || undefined} className="dt-table">
        <caption className="sr-only">{caption}</caption>

        <thead role="rowgroup">
          <tr role="row">
            {selectable && (
              <th role="columnheader" scope="col" data-priority="1" data-label="Select" style={{ width: "2.75rem" }}>
                <Checkbox label="Select all rows" hideLabel checked={ids.length > 0 && chosen === ids.length} indeterminate={chosen > 0 && chosen < ids.length} onCheckedChange={toggleAll} />
              </th>
            )}
            {columns.map((column) => {
              const sorted = sort?.columnId === column.id ? sort.direction : null;
              return (
                <th
                  key={column.id}
                  role="columnheader"
                  scope="col"
                  data-priority={column.priority ?? 1}
                  data-align={column.align ?? "start"}
                  aria-sort={column.sortable ? (sorted ?? "none") : undefined}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable ? (
                    <button type="button" onClick={() => onSortChange?.(nextSort(sort, column.id))} className="dt-sort">
                      <span className="min-w-0 break-words">{column.header}</span>
                      {sorted === "ascending" ? <ArrowUp size={12} aria-hidden /> : sorted === "descending" ? <ArrowDown size={12} aria-hidden /> : <ChevronsUpDown size={12} aria-hidden />}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody role="rowgroup">
          {loading && (
            <tr role="row">
              <td role="cell" colSpan={span} data-priority="1">
                <Skeleton lines={3} label={`Loading ${caption}`} />
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr role="row">
              <td role="cell" colSpan={span} data-priority="1" className="text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => {
              const id = getRowId(row);
              const active = id === activeId;
              return (
                <tr
                  key={id}
                  role="row"
                  tabIndex={interactive ? (id === tabStop ? 0 : -1) : undefined}
                  aria-current={active ? "true" : undefined}
                  aria-selected={selectable ? selectedIds.has(id) : undefined}
                  data-active={active || undefined}
                  data-interactive={interactive || undefined}
                  onFocus={interactive ? () => setFocusId(id) : undefined}
                  onKeyDown={interactive ? (event) => onRowKeyDown(event, row, id) : undefined}
                  onClick={onRowActivate ? (event) => onRowClick(event, row) : undefined}
                >
                  {selectable && (
                    <td role="gridcell" data-priority="1" data-label="Select">
                      <Checkbox label={rowLabel ? rowLabel(row) : `Select ${id}`} hideLabel checked={selectedIds.has(id)} onCheckedChange={() => toggle(id)} />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      role={interactive ? "gridcell" : "cell"}
                      data-priority={column.priority ?? 1}
                      data-label={column.header}
                      data-align={column.align ?? "start"}
                      className={cn(column.mono && "font-mono tabular")}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
