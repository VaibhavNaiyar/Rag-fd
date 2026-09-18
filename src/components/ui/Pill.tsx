"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillTone = "neutral" | "primary" | "brand" | "ok" | "warn" | "error";

/**
 * Tone classes pair a colour with a border, never with colour alone — every
 * caller is also required to pass a label, so a grayscale screenshot still reads.
 */
const TONES: Record<PillTone, string> = {
  neutral: "bg-sunken text-ink-muted border-line",
  primary: "bg-primary-soft text-primary-ink border-edge-primary",
  brand: "bg-primary-soft text-brand border-edge-brand",
  ok: "bg-ok-soft text-[var(--ok-ink)] border-edge-ok",
  warn: "bg-warn-soft text-warn-ink border-edge-warn",
  error: "bg-error-soft text-error border-edge-error",
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  icon?: ReactNode;
  mono?: boolean;
  children: ReactNode;
}

export function Pill({ tone = "neutral", icon, mono = false, className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5",
        "text-caption font-medium leading-4 whitespace-nowrap",
        mono && "font-mono tabular",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
