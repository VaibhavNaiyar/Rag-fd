"use client";

import { cn } from "@/lib/cn";

export interface StatProps {
  label: string;
  value: string;
  /** Optional qualifier under the value, e.g. "before utterance end". */
  hint?: string;
  tone?: "default" | "primary" | "ok" | "warn" | "error";
  className?: string;
}

const VALUE_TONES: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-ink",
  primary: "text-primary-ink",
  ok: "text-[var(--ok-ink)]",
  warn: "text-warn-ink",
  error: "text-error",
};

/** One readout in the metrics bar. Mono + tabular so digits do not jitter. */
export function Stat({ label, value, hint, tone = "default", className }: StatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-caption uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={cn("font-mono text-[15px] font-semibold tabular leading-6", VALUE_TONES[tone])}>
        {value}
      </div>
      {hint && <div className="truncate text-caption text-ink-muted">{hint}</div>}
    </div>
  );
}
