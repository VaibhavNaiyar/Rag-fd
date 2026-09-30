import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  /** What is missing and why, or what to do about it. */
  children?: ReactNode;
  /** The next step, usually a Button. */
  action?: ReactNode;
  /** Heading level for the title. Default 3. */
  level?: 2 | 3 | 4;
  className?: string;
}

/**
 * Nothing here yet, said plainly: a title, a sentence, and the one thing to do next.
 * Left-aligned, no illustration, no greeting. It does not claim data exists that does not.
 */
export function EmptyState({ title, children, action, level = 3, className }: EmptyStateProps) {
  const Heading = `h${level}` as const;
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-2 rounded-2 border border-line bg-surface-2 p-4", className)}>
      <Heading className="text-heading text-ink">{title}</Heading>
      {children && <div className="max-w-prose break-words text-body text-ink-muted">{children}</div>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
