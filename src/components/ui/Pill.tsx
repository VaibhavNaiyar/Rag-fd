"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

/**
 * LEGACY, deleted in P12: the old name of Badge, with its old props, so the screens
 * that still use it keep working. It is Badge underneath, so it no longer forces its
 * row wider than the screen, and its `title` is a real tooltip.
 */
export type PillTone = "neutral" | "primary" | "brand" | "ok" | "warn" | "error";

const TONES: Record<PillTone, BadgeTone> = {
  neutral: "neutral",
  primary: "accent",
  brand: "accent",
  ok: "ok",
  warn: "warn",
  error: "error",
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  icon?: ReactNode;
  mono?: boolean;
  children: ReactNode;
}

export function Pill({ tone = "neutral", icon, mono = false, title, children, ...props }: PillProps) {
  return (
    <Badge tone={TONES[tone]} glyph={icon} mono={mono} tooltip={title} {...props}>
      {children}
    </Badge>
  );
}
