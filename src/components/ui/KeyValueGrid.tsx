"use client";

import type { CSSProperties, ReactNode } from "react";
import { KeyValueContext } from "@/components/ui/MetricCell";
import { cn } from "@/lib/cn";

export interface KeyValueGridProps {
  children: ReactNode;
  /** Fix the number of columns. Default: chosen from the width of the grid's own container, 1 to 4. */
  columns?: 1 | 2 | 3 | 4;
  /** Names the list for assistive technology when there is no heading above it. */
  label?: string;
  className?: string;
}

/**
 * A description list laid out in columns that follow the width of the space it is
 * in, not the window: one column under 320 px, two from 320, three from 560, four
 * from 800 (containers.css). A narrow Inspector on a wide desktop therefore reflows
 * exactly like a phone does.
 */
export function KeyValueGrid({ children, columns, label, className }: KeyValueGridProps) {
  const style = columns ? ({ "--kv-cols": columns } as CSSProperties) : undefined;
  return (
    <div className={cn("kv", className)} data-cols={columns} style={style}>
      <KeyValueContext.Provider value>
        <dl aria-label={label} className="kv-grid m-0">
          {children}
        </dl>
      </KeyValueContext.Provider>
    </div>
  );
}
