"use client";

import { ChartTable } from "@/components/ui/ChartTable";
import { binValues } from "@/components/ui/chartUtils";
import type { Provenance } from "@/components/ui/MetricCell";
import { cn } from "@/lib/cn";

export interface HistogramProps {
  label: string;
  values: readonly number[];
  /** Number of equal-width bins. Default 8. */
  bins?: number;
  unit?: string;
  format?: (value: number) => string;
  /** The drawn height in px. Default 48. */
  height?: number;
  provenance?: Provenance;
  /** Draw the table alternative. It is always there for assistive technology. */
  showTable?: boolean;
  className?: string;
}

const GAP = 1;

/**
 * How values are spread: bars of equal width, as tall as their count. It stretches to
 * the width it is given. The range and the number of values are HTML text under the
 * bars; each bin's range and count are in the table alternative.
 */
export function Histogram({ label, values, bins = 8, unit = "", format = String, height = 48, provenance, showTable = false, className }: HistogramProps) {
  const groups = binValues(values, bins);
  const tallest = groups.reduce((most, group) => Math.max(most, group.count), 0);
  const first = groups[0];
  const last = groups[groups.length - 1];
  const step = groups.length > 0 ? 100 / groups.length : 100;

  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <figcaption className="min-w-0 break-words text-caption text-ink-muted">{label}</figcaption>

      {groups.length === 0 || !first || !last ? (
        <p className="m-0 mt-1 text-caption text-ink-muted">No data {provenance ? `(${provenance})` : "(unavailable)"}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}: ${values.length} values from ${format(first.start)}${unit} to ${format(last.end)}${unit}, in ${groups.length} bins, most in one bin ${tallest}`}
            className="mt-1 block w-full"
            style={{ height }}
          >
            <line x1="0" x2="100" y1={height} y2={height} strokeWidth="1" vectorEffect="non-scaling-stroke" className="stroke-line" />
            {groups.map((group, index) => {
              const barHeight = tallest === 0 ? 0 : (group.count / tallest) * (height - 2);
              return barHeight > 0 ? <rect key={index} x={index * step + GAP / 2} y={height - barHeight} width={Math.max(step - GAP, 0.5)} height={barHeight} className="fill-accent-ink" /> : null;
            })}
          </svg>

          <p className="m-0 mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-caption tabular text-ink-muted">
            <span>
              {format(first.start)}
              {unit}
            </span>
            <span className="font-sans">n = {values.length}</span>
            <span>
              {format(last.end)}
              {unit}
            </span>
          </p>
          {provenance && <p className="m-0 text-caption text-ink-muted">{provenance}</p>}
        </>
      )}

      <ChartTable
        caption={`${label}: count per range`}
        columns={["Range", "Count"]}
        rows={groups.map((group) => [`${format(group.start)}${unit} to ${format(group.end)}${unit}`, group.count])}
        visible={showTable}
        className={showTable ? "mt-2" : undefined}
      />
    </figure>
  );
}
