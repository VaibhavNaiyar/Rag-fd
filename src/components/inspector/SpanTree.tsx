"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { StatusDot, type StatusShape, type StatusTone } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { formatCount, formatMs, formatUsd, EMPTY } from "@/lib/format";
import type { SpanKind, SpanNode } from "@/lib/trace/spans";

/** Depth-first, visible order — every span is always expanded (the tree is shallow: at most turn → lane → search), so "visible" is simply every non-root node, in the same order the DOM below renders them. */
function visibleRows(root: SpanNode): SpanNode[] {
  const rows: SpanNode[] = [];
  const visit = (node: SpanNode, isRoot: boolean) => {
    if (!isRoot) rows.push(node);
    for (const child of node.children) visit(child, false);
  };
  visit(root, true);
  return rows;
}

const KIND_MARK: Record<SpanKind, { shape: StatusShape; tone: StatusTone }> = {
  turn: { shape: "filled", tone: "neutral" },
  listen: { shape: "filled", tone: "wait" },
  plan: { shape: "filled", tone: "neutral" },
  retrieve: { shape: "filled", tone: "retrieve" },
  search: { shape: "filled", tone: "retrieve" },
  synthesise: { shape: "filled", tone: "ok" },
};

function windowLabel(span: SpanNode): string {
  if (span.startMs === null || span.endMs === null) return "timing unavailable";
  return `${formatMs(span.startMs)} to ${formatMs(span.endMs)}`;
}

interface RowsProps {
  nodes: readonly SpanNode[];
  depth: number;
  /** Every visible span's flat position, precomputed once by the caller — nothing here mutates it while rendering. */
  indexOf: ReadonlyMap<string, number>;
  focusedIndex: number;
  selectedId: string | null;
  onFocusIndex: (index: number) => void;
  onSelect: (span: SpanNode) => void;
  registerRef: (index: number, node: HTMLDivElement | null) => void;
}

/** Renders one level of the tree, recursing into a nested `role="group"` for any span with children — the ARIA tree pattern requires a treeitem's children to be its own DOM descendants, not siblings. */
function Rows({ nodes, depth, indexOf, focusedIndex, selectedId, onFocusIndex, onSelect, registerRef }: RowsProps) {
  return (
    <>
      {nodes.map((span) => {
        const index = indexOf.get(span.id) ?? 0;
        const mark = span.cancelled ? { shape: "barred" as const, tone: "warn" as const } : KIND_MARK[span.kind];
        const selected = selectedId === span.id;
        return (
          <div key={span.id} role="none">
            <div
              ref={(node) => registerRef(index, node)}
              role="treeitem"
              aria-level={depth}
              aria-expanded={span.children.length > 0 ? true : undefined}
              aria-selected={selected}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => {
                onFocusIndex(index);
                onSelect(span);
              }}
              className={cn(
                "flex h-row min-w-0 cursor-pointer items-center gap-2 rounded-1 px-2 outline-none",
                selected ? "bg-accent-soft" : "hover:bg-surface-2",
              )}
              style={{ paddingLeft: `${(depth - 1) * 12 + 8}px` }}
            >
              <StatusDot shape={mark.shape} tone={mark.tone} decorative />
              <span className="min-w-0 flex-1 truncate text-caption text-ink-body">{span.label}</span>
              {span.provenance !== "measured" && <span className="shrink-0 text-caption text-ink-muted">{span.provenance}</span>}
              <span className="shrink-0 font-mono text-caption tabular text-ink-muted">
                {span.metrics.latencyMs === null ? EMPTY : formatMs(span.metrics.latencyMs)} · {span.metrics.tokens === null ? EMPTY : formatCount(span.metrics.tokens)} ·{" "}
                {span.metrics.costUsd === null ? EMPTY : formatUsd(span.metrics.costUsd)}
              </span>
            </div>
            {span.children.length > 0 && (
              <div role="group">
                <Rows
                  nodes={span.children}
                  depth={depth + 1}
                  indexOf={indexOf}
                  focusedIndex={focusedIndex}
                  selectedId={selectedId}
                  onFocusIndex={onFocusIndex}
                  onSelect={onSelect}
                  registerRef={registerRef}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export interface SpanTreeProps {
  root: SpanNode;
  selectedId: string | null;
  onSelect: (span: SpanNode) => void;
}

/**
 * The span tree (P7-F02): one row per node under the turn — the root itself is
 * the tree's implicit scope, not a row. A single roving tab stop moves with
 * Up/Down through every visible row regardless of depth; Enter or Space
 * selects. The metrics footer is always `latency · tokens · cost`, in that
 * order, `—` for whichever a span does not carry.
 */
export function SpanTree({ root, selectedId, onSelect }: SpanTreeProps) {
  const rows = useMemo(() => visibleRows(root), [root]);
  const indexOf = useMemo(() => new Map(rows.map((span, index) => [span.id, index])), [rows]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const move = (next: number) => {
    const clamped = Math.min(rows.length - 1, Math.max(0, next));
    setFocusedIndex(clamped);
    refs.current[clamped]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(focusedIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(focusedIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(rows.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      const row = rows[focusedIndex];
      if (row) {
        event.preventDefault();
        onSelect(row);
      }
    }
  };

  if (rows.length === 0) return null;

  return (
    <div role="tree" aria-label={`Span tree for ${root.label}`} onKeyDown={onKeyDown} className="space-y-px">
      <Rows
        nodes={root.children}
        depth={1}
        indexOf={indexOf}
        focusedIndex={focusedIndex}
        selectedId={selectedId}
        onFocusIndex={setFocusedIndex}
        onSelect={onSelect}
        registerRef={(index, node) => {
          refs.current[index] = node;
        }}
      />
      <p className="sr-only">{rows.map((span) => `${span.label}, ${windowLabel(span)}`).join(". ")}</p>
    </div>
  );
}
