"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Set by KeyValueGrid, so a cell inside it renders as a dt/dd pair and outside it as plain text. */
export const KeyValueContext = createContext(false);

export type MetricTone = "default" | "accent" | "ok" | "warn" | "error";
/** Where a number came from (PHASES.md R6): read off the engine, computed by the console, or not available. */
export type Provenance = "measured" | "modelled" | "unavailable";

const VALUE_TONES: Record<MetricTone, string> = {
  default: "text-ink",
  accent: "text-accent-ink",
  ok: "text-ok-ink",
  warn: "text-warn-ink",
  error: "text-error-ink",
};

export interface MetricCellProps {
  label: string;
  /** `null` or `undefined` shows an em dash and marks the value unavailable. */
  value: ReactNode;
  unit?: string;
  /** A qualifier under the value, e.g. "before utterance end". */
  hint?: string;
  tone?: MetricTone;
  /** Says how far to trust the number. */
  provenance?: Provenance;
  className?: string;
}

/**
 * One readout: a label, a monospace value with its unit, and optionally where the
 * number came from. Inside a KeyValueGrid it is a term and its definition; on its
 * own it is plain text. Long values wrap rather than widen the grid.
 */
export function MetricCell({ label, value, unit, hint, tone = "default", provenance, className }: MetricCellProps) {
  const inGrid = useContext(KeyValueContext);
  const missing = value === null || value === undefined || value === "";
  const shown = missing ? "—" : value;
  const source = missing ? "unavailable" : provenance;

  const Term = inGrid ? "dt" : "p";
  const Definition = inGrid ? "dd" : "p";

  return (
    <div className={cn("min-w-0 border-t border-line pt-2", className)}>
      <Term className="text-caption text-ink-muted">{label}</Term>
      <Definition className={cn("m-0 mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1 font-mono text-heading tabular", VALUE_TONES[missing ? "default" : tone])}>
        <span className="min-w-0 break-words">{shown}</span>
        {unit && !missing && <span className="text-caption font-normal text-ink-muted">{unit}</span>}
      </Definition>
      {hint && <Definition className="m-0 text-caption text-ink-muted">{hint}</Definition>}
      {source && <Definition className="m-0 text-caption text-ink-muted">{source}</Definition>}
    </div>
  );
}
