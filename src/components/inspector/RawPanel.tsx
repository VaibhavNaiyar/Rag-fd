"use client";

import { useMemo } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { JsonViewer } from "@/components/ui/JsonViewer";
import type { TraceRecord } from "@/types/trace";

const BYTES_PER_KB = 2 ** 10;

function formatBytes(bytes: number): string {
  return bytes < BYTES_PER_KB ? `${bytes} B` : `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
}

/** The whole trace record, raw (P7-F15) — a tree to open and close, and the exact bytes to copy. */
export function RawPanel({ record }: { record: TraceRecord }) {
  const text = useMemo(() => JSON.stringify(record, null, 2), [record]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-caption text-ink-muted">{formatBytes(text.length)}</p>
        <CopyButton value={text} label="Copy the raw trace record" />
      </div>
      <JsonViewer value={record} label={`Trace record ${record.turn_id}`} />
    </div>
  );
}
