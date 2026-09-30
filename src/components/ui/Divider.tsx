import { cn } from "@/lib/cn";

/** A 1 px hairline. Vertical dividers stretch to the height of their row. */
export function Divider({ orientation = "horizontal", strong = false, className }: { orientation?: "horizontal" | "vertical"; strong?: boolean; className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch", strong ? "bg-line-strong" : "bg-line", "shrink-0", className)}
    />
  );
}
