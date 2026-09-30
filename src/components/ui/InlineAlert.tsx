"use client";

import { CircleCheck, Info, OctagonAlert, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "ok" | "warn" | "error";

/** Each tone has its own icon shape as well as its own colour, so the tone survives a grayscale screen. */
export const ALERT_TONES: Record<AlertTone, { box: string; icon: typeof Info; label: string }> = {
  info: { box: "border-line bg-surface-2 text-ink-body", icon: Info, label: "Information" },
  ok: { box: "border-ok-edge bg-ok-soft text-ok-ink", icon: CircleCheck, label: "Success" },
  warn: { box: "border-warn-edge bg-warn-soft text-warn-ink", icon: TriangleAlert, label: "Warning" },
  error: { box: "border-error-edge bg-error-soft text-error-ink", icon: OctagonAlert, label: "Error" },
};

export interface InlineAlertProps {
  tone?: AlertTone;
  title?: string;
  /** The message. Long unbroken text (a URL, an id) wraps. */
  children: ReactNode;
  /** A button or link for what to do about it. */
  action?: ReactNode;
  /** Shows a close button. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * A message in the flow of the page. It says what kind it is in words ("Error"), which
 * assistive technology reads, and in an icon whose shape differs by kind, as well as in
 * colour. An error is announced at once (`role="alert"`); the others politely (`role="status"`).
 */
export function InlineAlert({ tone = "info", title, children, action, onDismiss, className }: InlineAlertProps) {
  const { box, icon: Icon, label } = ALERT_TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex min-w-0 items-start gap-2 rounded-2 border px-3 py-2 text-body", box, className)}>
      <Icon size={16} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 break-words">
        <span className="sr-only">{label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
        {action && <div className="pt-2">{action}</div>}
      </div>
      {onDismiss && <IconButton label="Dismiss" size="sm" icon={<X size={14} />} onClick={onDismiss} className="-mr-1 -mt-1" />}
    </div>
  );
}
