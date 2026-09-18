"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Statements the corpus does not support.
 *
 * Kept as a separate block rather than inlined into the answer: the whole point
 * is that it reads as a different kind of statement. The border carries --warn
 * and the words carry --warn-ink, because #FFC600 as text is ~1.7:1 on white.
 */
export function UncertaintyNote({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-l-[3px] border-line border-l-warn bg-warn-soft px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-label font-semibold text-warn-ink">
        <AlertTriangle size={14} aria-hidden />
        Not supported by the corpus:
      </p>
      <ul className="mt-1.5 space-y-1 pl-5 text-caption text-warn-ink [list-style:disc]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
