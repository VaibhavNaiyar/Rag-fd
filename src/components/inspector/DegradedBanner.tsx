"use client";

import { InlineAlert } from "@/components/ui/InlineAlert";
import type { TraceRecord } from "@/types/trace";

/** `degraded[]` and `errors[]`, at the top of the Inspector (P7-F16) — a model step that fell back to its offline strategy, or an outright error, both said plainly before anything else. */
export function DegradedBanner({ record }: { record: TraceRecord }) {
  if (record.degraded === undefined && record.errors.length === 0) return null;

  return (
    <div className="space-y-2 p-3 pb-0">
      {record.degraded?.map((step, index) => (
        <InlineAlert key={`degraded-${index}`} tone="warn" title={`"${step.step}" fell back to its offline strategy`}>
          {step.reason}
          {step.after_text ? " — the answer was cut short as a result." : "."}
        </InlineAlert>
      ))}
      {record.errors.map((message, index) => (
        <InlineAlert key={`error-${index}`} tone="error" title="Error on this turn">
          {message}
        </InlineAlert>
      ))}
    </div>
  );
}
