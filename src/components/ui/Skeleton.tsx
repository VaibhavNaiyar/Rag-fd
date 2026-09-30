import { cn } from "@/lib/cn";

const WIDTHS = ["w-full", "w-5/6", "w-2/3", "w-3/4", "w-1/2"];

/**
 * A placeholder for content that is on its way: still grey bars, no shimmer. It says
 * "Loading" to assistive technology and marks its region busy. Motion is not needed
 * to tell a reader that something is coming, and this is not it.
 */
export function Skeleton({ lines = 3, label = "Loading", className }: { lines?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <span key={index} aria-hidden className={cn("block h-3 rounded-1 bg-surface-3", WIDTHS[index % WIDTHS.length])} />
      ))}
    </div>
  );
}
