"use client";

import { cn } from "@/lib/cn";

export type SpinnerSize = "sm" | "md" | "lg";

const SIZES: Record<SpinnerSize, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-6",
};

/**
 * Something is loading. The only motion in the system besides the sheet slide, and
 * the only element with a circular outline besides the status dot, which is why
 * `rounded-full` is allowed in this file. Reduced motion stops the rotation (base.css);
 * the label still says what is happening, because motion is never the only signal.
 */
export function Spinner({ label = "Loading", size = "md", className }: { label?: string; size?: SpinnerSize; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex shrink-0 items-center", className)}>
      <span aria-hidden className={cn("block animate-spin rounded-full border-2 border-line-control border-t-accent-ink", SIZES[size])} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
