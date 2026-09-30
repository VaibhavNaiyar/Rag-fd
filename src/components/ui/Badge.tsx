"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { useIsTruncated } from "@/components/ui/useIsTruncated";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "error";

/**
 * A tone is a fill, an outline and a text colour chosen together so the text stays
 * above 4.5:1 on its own fill. The words carry the meaning; the tone reinforces it.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-2 text-ink-muted",
  accent: "border-accent-edge bg-accent-soft text-accent-ink",
  ok: "border-ok-edge bg-ok-soft text-ok-ink",
  warn: "border-warn-edge bg-warn-soft text-warn-ink",
  error: "border-error-edge bg-error-soft text-error-ink",
};

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "title"> {
  tone?: BadgeTone;
  /** A small mark before the text (a StatusDot, an icon). Hidden from assistive technology: the words say it. */
  glyph?: ReactNode;
  /** Ids, times and counts read better in the monospace face. */
  mono?: boolean;
  /** Let a long label wrap onto more lines instead of being cut off with an ellipsis. */
  wrap?: boolean;
  /** An explanation shown in a tooltip and wired to the badge with aria-describedby. */
  tooltip?: ReactNode;
  children: ReactNode;
}

/**
 * A short label with a tone: 20 px tall, radius 4, text 12. It never forces its row
 * wider than the screen: a label longer than its space is truncated (with the full
 * text in a tooltip) or, in `wrap` mode, broken over lines.
 */
export function Badge({ tone = "neutral", glyph, mono = false, wrap = false, tooltip, className, children, ...props }: BadgeProps) {
  const { ref, truncated } = useIsTruncated<HTMLSpanElement>(typeof children === "string" ? children : undefined);
  const explained = tooltip !== undefined;
  const cutOff = !wrap && truncated;

  return (
    <Tooltip label={explained ? tooltip : children} describe={explained} disabled={!explained && !cutOff}>
      <span
        {...props}
        className={cn(
          "inline-flex min-h-5 max-w-full min-w-0 items-center gap-1 rounded-2 border px-2 text-caption font-medium",
          wrap && "py-px",
          mono && "font-mono tabular",
          TONES[tone],
          className,
        )}
      >
        {glyph && (
          <span aria-hidden className="inline-flex shrink-0 items-center">
            {glyph}
          </span>
        )}
        <span ref={ref} className={cn("min-w-0", wrap ? "break-words" : "truncate")}>
          {children}
        </span>
      </span>
    </Tooltip>
  );
}
