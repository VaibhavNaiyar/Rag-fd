"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { captureFocus, trapTab } from "@/components/ui/focus";
import { IconButton } from "@/components/ui/IconButton";
import { Portal, useLayer } from "@/components/ui/Portal";
import { cn } from "@/lib/cn";

export type SheetSide = "left" | "right" | "bottom";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's name, shown in its header. */
  title: string;
  description?: string;
  /** Which edge it slides in from. Default "right". */
  side?: SheetSide;
  /** Controls in the header, before the close button. */
  actions?: ReactNode;
  /** Classes for the panel, e.g. a different width. */
  className?: string;
  children: ReactNode;
}

const PANEL: Record<SheetSide, string> = {
  right: "inset-y-0 right-0 w-[min(var(--inspector-w),100vw)] max-sm:w-full border-l pr-safe-right",
  left: "inset-y-0 left-0 w-[min(var(--inspector-w),100vw)] max-sm:w-full border-r pl-safe-left",
  bottom: "inset-x-0 bottom-0 max-h-[calc(100dvh-var(--space-8))] border-t",
};

const FROM: Record<SheetSide, string> = {
  right: "translateX(100%)",
  left: "translateX(-100%)",
  bottom: "translateY(100%)",
};

/**
 * A panel that slides in from an edge over a scrim (WAI-ARIA modal dialog). While it
 * is open the page behind it is inert and does not scroll, Tab stays inside it, Escape
 * or a press on the scrim closes it, and focus goes back to what opened it. The panel
 * is at most as wide as the viewport, so at 375 px it is a full-screen page. Reduced
 * motion removes the slide (base.css).
 */
export function Sheet(props: SheetProps) {
  return props.open ? (
    <Portal>
      <SheetLayer {...props} />
    </Portal>
  ) : null;
}

function SheetLayer({ onOpenChange, title, description, side = "right", actions, className, children }: SheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const latest = useRef(onOpenChange);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    latest.current = onOpenChange;
  });

  // Declared first, so when the sheet closes the page is made live again before focus goes back to it.
  useLayer({ open: true, modal: true, onEscape: () => latest.current(false), elementRef: rootRef });

  useLayoutEffect(() => {
    restoreRef.current = captureFocus();
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    return () => restoreRef.current?.();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => trapTab(event, event.currentTarget);

  return (
    <div ref={rootRef} className="fixed inset-0 z-sheet">
      <div aria-hidden className="absolute inset-0 bg-scrim" onClick={() => latest.current(false)} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ "--sheet-from": FROM[side] } as CSSProperties}
        className={cn("absolute flex min-h-0 flex-col border-line-strong bg-surface text-ink-body shadow-overlay outline-none animate-sheet-in", PANEL[side], className)}
      >
        <header className="flex min-h-row shrink-0 items-center gap-2 border-b border-line pl-3 pr-1 pt-safe-top">
          <h2 id={titleId} className="min-w-0 flex-1 break-words text-heading text-ink">
            {title}
          </h2>
          {actions}
          <IconButton label="Close" icon={<X size={16} />} onClick={() => latest.current(false)} />
        </header>
        {description && (
          <p id={descriptionId} className="border-b border-line px-3 py-2 text-caption text-ink-muted">
            {description}
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto pb-safe-bottom">{children}</div>
      </div>
    </div>
  );
}
