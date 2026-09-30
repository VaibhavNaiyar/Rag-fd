"use client";

import { Check, Minus, X } from "lucide-react";
import { ChartTable } from "@/components/ui/ChartTable";
import { percentOf } from "@/components/ui/chartUtils";
import type { Provenance } from "@/components/ui/MetricCell";
import { cn } from "@/lib/cn";

export interface ThresholdMeterProps {
  label: string;
  /** `null` means the value is not available: it is shown as an em dash, never as zero. */
  value: number | null;
  target: number;
  /** "atMost": lower is better (latency). "atLeast": higher is better (a support rate). */
  direction: "atMost" | "atLeast";
  unit?: string;
  format?: (value: number) => string;
  /** The end of the scale. Default: a quarter beyond the larger of the value and the target. */
  scaleMax?: number;
  provenance?: Provenance;
  /** Draw the table alternative. It is always there for assistive technology. */
  showTable?: boolean;
  className?: string;
}

const STATUS_WORDS = {
  atMost: { pass: "Within target", fail: "Over target" },
  atLeast: { pass: "Meets target", fail: "Below target" },
} as const;

/**
 * A measurement against its target: the value, a bar drawn to scale with a tick at the
 * target, and a pass or fail mark. The mark is a check or a cross with words beside it,
 * as well as green or red, so the verdict never depends on colour. The numbers are HTML
 * text (12 px or more); only the bar is SVG, and it stretches to the width it is given.
 */
export function ThresholdMeter({ label, value, target, direction, unit = "", format = String, scaleMax, provenance, showTable = false, className }: ThresholdMeterProps) {
  const available = value !== null && Number.isFinite(value);
  const pass = available && (direction === "atMost" ? value <= target : value >= target);
  const max = scaleMax ?? Math.max(available ? value : 0, target) * 1.25;
  const words = STATUS_WORDS[direction];
  const verdict = !available ? "Not available" : pass ? words.pass : words.fail;
  const shown = available ? `${format(value)}${unit}` : "—";
  const goal = `${direction === "atMost" ? "≤" : "≥"} ${format(target)}${unit}`;

  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <figcaption className="min-w-0 break-words text-caption text-ink-muted">{label}</figcaption>
        <p className="m-0 flex items-center gap-1 font-mono text-heading font-semibold tabular text-ink">
          {available && (pass ? <Check size={14} aria-hidden className="text-ok-ink" /> : <X size={14} aria-hidden className="text-error-ink" />)}
          {!available && <Minus size={14} aria-hidden className="text-ink-muted" />}
          <span>{shown}</span>
        </p>
      </div>

      <svg viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label={`${label}: ${shown}, target ${goal}. ${verdict}.`} className="mt-1 block h-2 w-full">
        <rect x="0" y="0" width="100" height="8" className="fill-surface-3" />
        {available && <rect x="0" y="0" width={percentOf(value, max)} height="8" className={pass ? "fill-ok" : "fill-error"} />}
        <line x1={percentOf(target, max)} x2={percentOf(target, max)} y1="0" y2="8" strokeWidth="2" vectorEffect="non-scaling-stroke" className="stroke-ink" />
      </svg>

      <p className="m-0 mt-1 flex flex-wrap items-baseline gap-x-2 text-caption text-ink-muted">
        <span className="font-mono tabular">target {goal}</span>
        <span className={cn("font-medium", !available ? "text-ink-muted" : pass ? "text-ok-ink" : "text-error-ink")}>{verdict}</span>
        {provenance && <span>{provenance}</span>}
      </p>

      <ChartTable
        caption={`${label}: value against target`}
        columns={["Measure", "Value"]}
        rows={[
          ["Value", shown],
          ["Target", goal],
          ["Result", verdict],
        ]}
        visible={showTable}
        className={showTable ? "mt-2" : undefined}
      />
    </figure>
  );
}
