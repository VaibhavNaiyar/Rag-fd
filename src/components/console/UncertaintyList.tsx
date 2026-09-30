"use client";

import { InlineAlert } from "@/components/ui/InlineAlert";

/** Statements the corpus does not support (P6-F09, replaces `UncertaintyNote`) — a warn `InlineAlert`, so the tone carries text as well as colour. */
export function UncertaintyList({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <InlineAlert tone="warn" title="Not supported by the corpus">
        <ul className="space-y-1 [list-style:disc] pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </InlineAlert>
    </div>
  );
}
