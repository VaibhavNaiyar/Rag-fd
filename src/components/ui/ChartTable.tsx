import { cn } from "@/lib/cn";

export interface ChartTableProps {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly (string | number)[])[];
  /** Draw it. Default false: it is then read by assistive technology only, which is what every chart must offer. */
  visible?: boolean;
  className?: string;
}

/**
 * The same numbers as a chart, as a table (PHASES.md §3.1: every chart has a table
 * alternative). A screen reader cannot read a polyline; it can read this. Turn
 * `visible` on for anyone who prefers figures to shapes.
 */
export function ChartTable({ caption, columns, rows, visible = false, className }: ChartTableProps) {
  return (
    <table className={cn(visible ? "w-full table-fixed border-collapse text-caption [overflow-wrap:anywhere]" : "sr-only", className)}>
      <caption className={visible ? "pb-1 text-left text-caption text-ink-muted" : undefined}>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col" className={cn("text-left", visible && "border-b border-line-strong px-1 py-1 font-medium text-ink-muted")}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, at) => (
          <tr key={at}>
            {row.map((cell, index) => (
              <td key={index} className={cn(visible && "border-b border-line px-1 py-1 font-mono tabular")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
