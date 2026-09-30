"use client";

import { X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { announce } from "@/components/ui/a11y";
import { Button } from "@/components/ui/Button";
import { ALERT_TONES, type AlertTone } from "@/components/ui/InlineAlert";
import { IconButton } from "@/components/ui/IconButton";
import { Portal } from "@/components/ui/Portal";
import { cn } from "@/lib/cn";

export interface ToastOptions {
  title?: string;
  message: string;
  tone?: AlertTone;
  /** How long it stays. Default 4000 ms. The clock stops while the reader hovers or focuses it. */
  durationMs?: number;
  action?: { label: string; onAction: () => void };
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastApi {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => 0, dismiss: () => undefined });

/** `const { toast } = useToast()`. Without a ToastProvider above it, calls do nothing. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DEFAULT_MS = 4000;

/**
 * Brief messages about something that just happened. At most `max` (default 3) are on
 * screen; the rest wait their turn. Each is announced to a screen reader when it is
 * added (assertively for errors), so nothing depends on seeing it. It never takes
 * focus. Hovering or focusing it pauses its timer.
 */
export function ToastProvider({ max = 3, children }: { max?: number; children: ReactNode }) {
  const [queue, setQueue] = useState<ToastRecord[]>([]);

  // One stable object: consumers can list it in a dependency array without re-running.
  const [api] = useState<ToastApi>(() => {
    let next = 1;
    return {
      toast: (options) => {
        const id = next;
        next += 1;
        setQueue((current) => [...current, { ...options, id }]);
        announce([options.title, options.message].filter(Boolean).join(". "), options.tone === "error" ? "assertive" : "polite");
        return id;
      },
      dismiss: (id) => setQueue((current) => current.filter((item) => item.id !== id)),
    };
  });

  const shown = queue.slice(0, max);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {shown.length > 0 && (
        <Portal>
          <div
            role="region"
            aria-label="Notifications"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-end gap-2 p-gutter max-md:pb-[calc(var(--tabbar-h)+var(--safe-bottom)+var(--space-4))]"
          >
            {shown.map((record) => (
              <ToastItem key={record.id} record={record} onDismiss={api.dismiss} />
            ))}
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ record, onDismiss }: { record: ToastRecord; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(record.durationMs ?? DEFAULT_MS);
  const { box, icon: Icon, label } = ALERT_TONES[record.tone ?? "info"];

  // Counts down while nothing holds it; on pause, remembers how much time was left.
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(record.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, onDismiss, record.id]);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
  };

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={onBlur}
      className={cn("pointer-events-auto flex w-full max-w-sm min-w-0 items-start gap-2 rounded-2 border px-3 py-2 text-body shadow-float", box)}
    >
      <Icon size={16} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 break-words">
        <span className="sr-only">{label}: </span>
        {record.title && <p className="font-semibold">{record.title}</p>}
        <p>{record.message}</p>
        {record.action && (
          <div className="pt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                record.action?.onAction();
                onDismiss(record.id);
              }}
            >
              {record.action.label}
            </Button>
          </div>
        )}
      </div>
      <IconButton label="Dismiss" size="sm" icon={<X size={14} />} onClick={() => onDismiss(record.id)} className="-mr-1 -mt-1" />
    </div>
  );
}
