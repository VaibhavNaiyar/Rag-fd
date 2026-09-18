"use client";

import { SearchX } from "lucide-react";
import { reasonLabel } from "@/lib/decisions";

/**
 * Shown when the controller decided a turn needed no retrieval at all.
 *
 * Querying the index because the user asked to reformat prior output is one of
 * the named pitfalls; making the skip visible is how a judge sees it was a
 * decision rather than a failure.
 */
export function SuppressedNote({ reason }: { reason: string }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-caption text-ink-muted">
      <SearchX size={13} aria-hidden className="shrink-0" />
      Reformatted from session state — no retrieval needed ({reasonLabel(reason)}).
    </p>
  );
}
