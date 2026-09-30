"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PanelProps {
  title: string;
  /** Heading level, so the panel fits the outline of the page. Default 2. */
  level?: 2 | 3 | 4;
  /** A count after the title, in the monospace face. */
  count?: number;
  /** Controls at the end of the header. */
  actions?: ReactNode;
  /** "boxed": a hairline border and radius 4. "flush": no border, for a pane that already has edges. Default "boxed". */
  variant?: "boxed" | "flush";
  /** Pad the body by 12 px. Default true; turn it off for a table or a list that reaches the edges. */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A titled region: a header with the title, an optional count and actions, and a body.
 * It is a landmark (`section` named by its heading). The body is the scroll container,
 * so a panel in a flex or grid column scrolls its own content instead of growing the page.
 */
export function Panel({ title, level = 2, count, actions, variant = "boxed", padded = true, className, children }: PanelProps) {
  const headingId = useId();
  const Heading = `h${level}` as const;

  return (
    <section aria-labelledby={headingId} className={cn("flex min-h-0 min-w-0 flex-col bg-surface", variant === "boxed" && "rounded-2 border border-line", className)}>
      <header className="flex min-h-row shrink-0 items-center gap-2 border-b border-line px-3">
        <Heading id={headingId} className="min-w-0 flex-1 break-words text-label font-semibold text-ink">
          {title}
        </Heading>
        {count !== undefined && <span className="font-mono text-caption tabular text-ink-muted">{count}</span>}
        {actions}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", padded && "p-3")}>{children}</div>
    </section>
  );
}
