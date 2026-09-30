"use client";

import { cn } from "@/lib/cn";

/**
 * A mark whose shape says what colour alone cannot (PHASES.md §3.1, principle 6):
 *
 *   ring      hollow circle    waiting, idle
 *   filled    solid circle     active, healthy
 *   diamond   solid diamond    refining
 *   barred    circle with bar  suppressed, blocked
 *
 * 8 px, no pulse. It is the only element besides the spinner that may be round.
 */
export type StatusShape = "ring" | "filled" | "diamond" | "barred";

export type StatusTone = "neutral" | "wait" | "retrieve" | "refine" | "suppress" | "ok" | "warn" | "error";

const FILL: Record<StatusTone, string> = {
  neutral: "bg-line-control",
  wait: "bg-state-wait",
  retrieve: "bg-state-retrieve",
  refine: "bg-state-refine",
  suppress: "bg-state-suppress",
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-error",
};

const EDGE: Record<StatusTone, string> = {
  neutral: "border-line-control",
  wait: "border-state-wait",
  retrieve: "border-state-retrieve",
  refine: "border-state-refine",
  suppress: "border-state-suppress",
  ok: "border-ok",
  warn: "border-warn",
  error: "border-error",
};

interface StatusDotBase {
  shape: StatusShape;
  tone: StatusTone;
  className?: string;
}

/** Either a label, so the mark is an image with a name, or `decorative`, for a mark that sits beside the same words. */
export type StatusDotProps = StatusDotBase & ({ label: string; decorative?: false } | { decorative: true; label?: string });

export function StatusDot(props: StatusDotProps) {
  const { shape, tone, className } = props;
  const accessibility = props.decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": props.label };

  return (
    <span {...accessibility} data-shape={shape} className={cn("relative inline-block size-2 shrink-0", className)}>
      {shape === "ring" && <span className={cn("absolute inset-0 rounded-full border-2", EDGE[tone])} />}
      {shape === "filled" && <span className={cn("absolute inset-0 rounded-full", FILL[tone])} />}
      {shape === "diamond" && <span className={cn("absolute inset-px rotate-45", FILL[tone])} />}
      {shape === "barred" && (
        <>
          <span className={cn("absolute inset-0 rounded-full border border-solid", EDGE[tone])} />
          <span className={cn("absolute left-0 top-1/2 block h-px w-full -translate-y-1/2 -rotate-45", FILL[tone])} />
        </>
      )}
    </span>
  );
}
