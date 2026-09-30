"use client";

import { ChartTable } from "@/components/ui/ChartTable";
import { layoutSeries } from "@/components/ui/chartUtils";
import type { Provenance } from "@/components/ui/MetricCell";
import { cn } from "@/lib/cn";

export interface SparklineProps {
  label: string;
  /** The series in order. `null` is a gap: the line breaks there instead of dropping to zero. */
  values: readonly (number | null)[];
  /** One label per value for the table alternative: turn ids, times. Default 1, 2, 3 and so on. */
  pointLabels?: readonly string[];
  unit?: string;
  format?: (value: number) => string;
  /** The drawn height in px. Default 32. */
  height?: number;
  provenance?: Provenance;
  /** Draw the table alternative. It is always there for assistive technology. */
  showTable?: boolean;
  className?: string;
}

/**
 * The shape of a series: one line, no fill, no markers, no animation. It stretches to
 * the width it is given (`viewBox` and `width: 100%`) and its stroke stays 1.5 px however
 * far it stretches. The last value, the lowest and the highest are HTML text under it,
 * because a shape cannot say what the numbers are.
 */
export function Sparkline({ label, values, pointLabels, unit = "", format = String, height = 32, provenance, showTable = false, className }: SparklineProps) {
  const series = layoutSeries(values, 100, height);
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const last = known[known.length - 1];
  const empty = known.length === 0;

  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <figcaption className="min-w-0 break-words text-caption text-ink-muted">{label}</figcaption>

      {empty ? (
        <p className="m-0 mt-1 text-caption text-ink-muted">No data {provenance ? `(${provenance})` : "(unavailable)"}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}: ${known.length} values, from ${format(series.min)}${unit} to ${format(series.max)}${unit}, last ${format(last ?? 0)}${unit}`}
            className="mt-1 block w-full"
            style={{ height }}
          >
            <line x1="0" x2="100" y1={height} y2={height} strokeWidth="1" vectorEffect="non-scaling-stroke" className="stroke-line" />
            {series.runs.map((points) => (
              <polyline key={points} points={points} fill="none" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="stroke-accent-ink" />
            ))}
            {series.lone.map((point) => (
              <line key={`${point.x},${point.y}`} x1={point.x} x2={point.x} y1={point.y - 3} y2={point.y + 3} strokeWidth="2" vectorEffect="non-scaling-stroke" className="stroke-accent-ink" />
            ))}
          </svg>

          <p className="m-0 mt-1 flex flex-wrap gap-x-3 font-mono text-caption tabular text-ink-muted">
            <span>last {last === undefined ? "—" : `${format(last)}${unit}`}</span>
            <span>min {format(series.min)}{unit}</span>
            <span>max {format(series.max)}{unit}</span>
            {provenance && <span className="font-sans">{provenance}</span>}
          </p>
        </>
      )}

      <ChartTable
        caption={`${label}: values in order`}
        columns={["Point", "Value"]}
        rows={values.map((value, at) => [pointLabels?.[at] ?? String(at + 1), value === null || !Number.isFinite(value) ? "—" : `${format(value)}${unit}`])}
        visible={showTable}
        className={showTable ? "mt-2" : undefined}
      />
    </figure>
  );
}
