"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { PaneResizer } from "@/components/shell/PaneResizer";
import { captureFocus } from "@/components/ui/focus";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { useStoredNumber } from "@/hooks/useStoredNumber";
import { INSPECTOR, clampInspector } from "@/lib/layout";

export interface WorkbenchProps {
  /** From 1024 px the Inspector docks beside the view; below it, it is a sheet. */
  docked: boolean;
  inspectorOpen: boolean;
  onCloseInspector: () => void;
  /** "Turn t3". Names the docked pane and the sheet. */
  inspectorTitle: string;
  inspector: ReactNode;
  /** The current view: the content of the page's <main>. */
  children: ReactNode;
}

/**
 * When the Inspector opens by the reader's own action, focus moves into it, and when it
 * closes, focus returns to what opened it. A page that loads already showing the Inspector
 * (a shared link) does not take focus. (Below 1024 px the sheet does this for itself.)
 */
function useDockFocus(open: boolean, docked: boolean, target: RefObject<HTMLElement | null>): void {
  const started = useRef(false);
  const restore = useRef<(() => void) | null>(null);

  useEffect(() => {
    const first = !started.current;
    started.current = true;
    if (!docked) return;
    if (open && !first) {
      restore.current = captureFocus();
      target.current?.focus({ preventScroll: true });
    } else if (!open && restore.current) {
      restore.current();
      restore.current = null;
    }
  }, [open, docked, target]);
}

/**
 * The view and the Inspector (PHASES.md §3.5). The view is the page's `main`. Docked, the
 * Inspector is a complementary region beside it with a drag handle between; its width is
 * kept between 360 and 720 px, leaves the view at least 360 px, and is remembered.
 * Below 1024 px the Inspector is a sheet instead, full width on a phone.
 */
export function Workbench({ docked, inspectorOpen, onCloseInspector, inspectorTitle, inspector, children }: WorkbenchProps) {
  const { ref, width: row } = useContainerWidth<HTMLDivElement>({ fallback: 1200 });
  const viewport = useBreakpoint();
  const fallback = viewport === "lg" ? INSPECTOR.defaultLg : INSPECTOR.default;
  const [stored, setStored] = useStoredNumber(INSPECTOR.storageKey, fallback);
  const aside = useRef<HTMLElement>(null);
  useDockFocus(inspectorOpen, docked, aside);

  const width = clampInspector(stored, row);
  const dockedOpen = docked && inspectorOpen;

  return (
    <div ref={ref} className="workbench" data-inspector={dockedOpen ? "docked" : "none"} style={{ "--inspector-size": `${width}px` } as CSSProperties}>
      <main id="main" tabIndex={-1} className="pane pr-safe-right outline-none">
        {children}
      </main>

      {dockedOpen && (
        <>
          <PaneResizer value={width} min={INSPECTOR.min} max={clampInspector(INSPECTOR.max, row)} defaultValue={fallback} onChange={setStored} />
          <aside ref={aside} aria-labelledby="inspector-title" tabIndex={-1} className="pane border-l-0 bg-surface pr-safe-right outline-none">
            <header className="sticky top-0 z-sticky flex min-h-row items-center gap-2 border-b border-line bg-surface pl-3 pr-1">
              <h2 id="inspector-title" className="min-w-0 flex-1 break-words text-heading text-ink">
                {inspectorTitle}
              </h2>
              <IconButton label="Close" icon={<X size={16} />} onClick={onCloseInspector} />
            </header>
            {inspector}
          </aside>
        </>
      )}

      {!docked && (
        <Sheet open={inspectorOpen} onOpenChange={(open) => !open && onCloseInspector()} title={inspectorTitle}>
          {inspector}
        </Sheet>
      )}
    </div>
  );
}
