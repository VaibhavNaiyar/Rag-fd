"use client";

import { MessageSquareText } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import type { SessionSummary } from "@/store/types";

export interface SessionItemProps {
  session: SessionSummary;
  active: boolean;
}

/**
 * One row in the session list.
 *
 * Deliberately not a button: memory is session-scoped by the theme's own
 * constraints, so there is no earlier session to switch back to. A control that
 * did nothing would be worse than no control.
 */
export function SessionItem({ session, active }: SessionItemProps) {
  return (
    <li
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2",
        active ? "bg-primary-soft text-primary-ink" : "text-ink-body",
      )}
    >
      <MessageSquareText
        size={15}
        aria-hidden
        className={cn("shrink-0", active ? "text-primary-ink" : "text-ink-muted")}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label">{session.title}</span>
        <span className="block truncate text-caption text-ink-muted">
          {session.turnCount} {session.turnCount === 1 ? "turn" : "turns"} ·{" "}
          {formatRelative(session.updatedAt)}
        </span>
      </span>
    </li>
  );
}
