"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { allCollectionIds, copyableValue, flatten, formatLeaf, initialExpanded, pathToString, summarise, type JsonKind, type JsonNode } from "@/components/ui/jsonTree";
import { cn } from "@/lib/cn";

export interface JsonViewerProps {
  value: unknown;
  /** The tree's accessible name: "Trace record t3". */
  label: string;
  /** How many levels are open to begin with. Default 1: the root and its children. */
  defaultExpandDepth?: number;
  className?: string;
}

const VALUE_TONES: Record<JsonKind, string> = {
  string: "text-ink-body",
  number: "text-accent-ink",
  boolean: "text-ink-muted",
  null: "text-ink-muted",
  object: "text-ink-muted",
  array: "text-ink-muted",
};

/** Indent by depth, in rem, and stop at eight levels so a deep value cannot push its text off a 375 px screen. */
const indent = (depth: number): string => `${0.5 + Math.min(depth, 8) * 0.75}rem`;

/**
 * A JSON value as a tree you can open and close (WAI-ARIA tree pattern). Up and Down
 * move between rows, Right opens a node or steps into it, Left closes it or steps out,
 * Home and End go to the ends, Enter or Space toggles. The path of the focused row is
 * shown above the tree, and can be copied, as can its value or the whole document.
 * Long strings wrap; nothing scrolls sideways.
 */
export function JsonViewer({ value, label, defaultExpandDepth = 1, className }: JsonViewerProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => initialExpanded(value, defaultExpandDepth));
  const [focusId, setFocusId] = useState<string | null>(null);

  const { nodes, truncated } = useMemo(() => flatten(value, expanded), [value, expanded]);
  const tabStop = focusId !== null && nodes.some((node) => node.id === focusId) ? focusId : nodes[0]?.id;
  const focused = nodes.find((node) => node.id === focusId) ?? nodes[0];

  const toggle = (id: string, open: boolean) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const current = rows.find((row) => row === document.activeElement);
    const at = current ? rows.indexOf(current) : -1;
    const node = at >= 0 ? nodes[at] : undefined;
    if (!node) return;

    const go = (row: HTMLElement | undefined) => {
      event.preventDefault();
      row?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
        return go(rows[Math.min(at + 1, rows.length - 1)]);
      case "ArrowUp":
        return go(rows[Math.max(at - 1, 0)]);
      case "Home":
        return go(rows[0]);
      case "End":
        return go(rows[rows.length - 1]);
      case "ArrowRight":
        event.preventDefault();
        if (node.expandable && !node.expanded) toggle(node.id, true);
        else if (node.expandable) rows[at + 1]?.focus();
        return;
      case "ArrowLeft": {
        event.preventDefault();
        if (node.expandable && node.expanded) {
          toggle(node.id, false);
          return;
        }
        // Step out to the parent: the nearest row above that is one level shallower.
        for (let up = at - 1; up >= 0; up -= 1) {
          if ((nodes[up]?.depth ?? 0) < node.depth) {
            rows[up]?.focus();
            return;
          }
        }
        return;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (node.expandable) toggle(node.id, !node.expanded);
        return;
    }
  };

  return (
    <div className={cn("min-w-0 rounded-2 border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-2 py-1">
        <p className="m-0 min-w-0 flex-1 break-words font-mono text-caption text-ink-muted">
          <span className="sr-only">Path: </span>
          {focused ? pathToString(focused.path) : "$"}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(allCollectionIds(value))}>
          Expand all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
          Collapse all
        </Button>
        <CopyButton value={focused ? pathToString(focused.path) : "$"} label="Copy path" />
        <CopyButton value={focused ? copyableValue(focused.value) : ""} label="Copy value" />
      </div>

      <div role="tree" aria-label={label} onKeyDown={onKeyDown} className="py-1">
        {nodes.map((node) => (
          <Row key={node.id} node={node} tabStop={node.id === tabStop} onFocus={() => setFocusId(node.id)} onToggle={() => node.expandable && toggle(node.id, !node.expanded)} />
        ))}
      </div>

      {truncated && <p className="m-0 border-t border-line px-2 py-1 text-caption text-ink-muted">Only the first rows are listed. Close a section to see the rest.</p>}
    </div>
  );
}

function Row({ node, tabStop, onFocus, onToggle }: { node: JsonNode; tabStop: boolean; onFocus: () => void; onToggle: () => void }) {
  return (
    <div
      role="treeitem"
      aria-level={node.depth + 1}
      aria-posinset={node.position}
      aria-setsize={node.siblings}
      aria-expanded={node.expandable ? node.expanded : undefined}
      aria-selected={false}
      tabIndex={tabStop ? 0 : -1}
      onFocus={onFocus}
      onClick={onToggle}
      style={{ paddingInlineStart: indent(node.depth) }}
      className={cn("flex min-w-0 items-start gap-1 py-px pr-2 font-mono text-label -outline-offset-2 hover:bg-surface-2 focus-visible:bg-surface-2", node.expandable && "cursor-pointer")}
    >
      <span aria-hidden className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-ink-muted">
        {node.expandable ? node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
      </span>
      {node.key !== null && <span className="shrink-0 text-ink-muted">{node.key}:</span>}
      {node.expandable || node.kind === "object" || node.kind === "array" ? (
        <span className="min-w-0 text-ink-muted [overflow-wrap:anywhere]">{summarise(node)}</span>
      ) : (
        <span className={cn("min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]", VALUE_TONES[node.kind])}>{formatLeaf(node)}</span>
      )}
    </div>
  );
}
