"use client";

/** The one empty-state treatment used by every trace section. */
export function EmptyHint({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-dashed border-line px-3 py-2.5 text-caption text-ink-muted">
      {children}
    </p>
  );
}
