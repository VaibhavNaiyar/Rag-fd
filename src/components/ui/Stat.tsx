"use client";

import { MetricCell, type MetricTone } from "@/components/ui/MetricCell";

export interface StatProps {
  label: string;
  value: string;
  /** Optional qualifier under the value, e.g. "before utterance end". */
  hint?: string;
  tone?: "default" | "primary" | "ok" | "warn" | "error";
  className?: string;
}

const TONES: Record<NonNullable<StatProps["tone"]>, MetricTone> = {
  default: "default",
  primary: "accent",
  ok: "ok",
  warn: "warn",
  error: "error",
};

/** LEGACY, deleted in P12: the old name of MetricCell, with its old props. */
export function Stat({ label, value, hint, tone = "default", className }: StatProps) {
  return <MetricCell label={label} value={value} hint={hint} tone={TONES[tone]} className={className} />;
}
