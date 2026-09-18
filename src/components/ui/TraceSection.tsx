"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TraceSectionProps {
  title: string;
  /** Small count or status shown beside the title, e.g. "3" or "none". */
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A collapsible block in the trace rail. Every rail section uses this so the
 * headers, spacing and disclosure behaviour stay identical down the column.
 */
export function TraceSection({ title, meta, defaultOpen = true, children }: TraceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-line last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-sunken"
        >
          <ChevronDown
            size={14}
            aria-hidden
            className={cn(
              "shrink-0 text-ink-muted transition-transform duration-200 ease-oneui",
              !open && "-rotate-90",
            )}
          />
          <span className="text-label font-semibold uppercase tracking-wide text-ink-muted">
            {title}
          </span>
          {meta !== undefined && (
            <span className="ml-auto font-mono text-caption tabular text-ink-muted">{meta}</span>
          )}
        </button>
      </h3>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
