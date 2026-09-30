"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import { cn } from "@/lib/cn";

export interface CodeBlockProps {
  code: string;
  /** Shown in the header, e.g. "json" or "python". */
  language?: string;
  /** The block's accessible name. Default: the language, or "Code". */
  label?: string;
  /** Stop growing at this height and scroll vertically. Default: grow with the code. */
  maxHeight?: "sm" | "md" | "lg";
  className?: string;
}

const HEIGHTS = { sm: "max-h-40", md: "max-h-80", lg: "max-h-[calc(100dvh-var(--space-12))]" } as const;

/**
 * Code as text: monospace, with a copy button. Lines wrap instead of scrolling, so a
 * 300-character line never puts a scrollbar under a phone. When the block is
 * height-limited it scrolls vertically and can be focused, so a keyboard reader can scroll it.
 */
export function CodeBlock({ code, language, label, maxHeight, className }: CodeBlockProps) {
  const name = label ?? (language ? `${language} code` : "Code");
  const limited = maxHeight !== undefined;

  return (
    <figure className={cn("m-0 min-w-0 rounded-2 border border-line bg-surface-2", className)}>
      <figcaption className="flex min-h-row items-center justify-between gap-2 border-b border-line pl-3 pr-1 text-caption text-ink-muted">
        <span className="min-w-0 break-words font-mono">{language ?? "text"}</span>
        <CopyButton value={code} label={`Copy ${name}`} />
      </figcaption>
      <pre
        role={limited ? "region" : undefined}
        aria-label={limited ? name : undefined}
        tabIndex={limited ? 0 : undefined}
        className={cn("m-0 whitespace-pre-wrap px-3 py-2 font-mono text-label text-ink-body", limited && cn("overflow-y-auto", HEIGHTS[maxHeight]))}
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
