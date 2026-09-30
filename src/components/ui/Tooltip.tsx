"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { placeFloating, trackFloating } from "@/components/ui/floating";
import { Portal, useLayer } from "@/components/ui/Portal";
import type { Side } from "@/components/ui/position";

interface TriggerProps {
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  "aria-describedby"?: string;
}

export interface TooltipProps {
  label: ReactNode;
  /** The one element the tooltip is about. It must pass these handlers on to a DOM element. */
  children: ReactElement<TriggerProps>;
  side?: Side;
  /** Milliseconds the pointer must rest on the trigger. Keyboard focus shows it at once. Default 500. */
  delay?: number;
  /** Wire the tooltip to the trigger with aria-describedby. Turn it off when the label repeats the trigger's own name. Default true. */
  describe?: boolean;
  /** Render the trigger alone. */
  disabled?: boolean;
}

const GRACE_MS = 100;
const MAX_WIDTH = 320;

/**
 * The show and hide timers, held in an object rather than a ref so the handlers that
 * use them can be built during render without reading a ref there.
 */
class Timing {
  private id = 0;

  constructor(private readonly set: (anchor: HTMLElement | null) => void) {}

  clear(): void {
    window.clearTimeout(this.id);
  }

  to(anchor: HTMLElement | null, wait: number): void {
    this.clear();
    if (wait <= 0) this.set(anchor);
    else this.id = window.setTimeout(() => this.set(anchor), wait);
  }
}

/**
 * A short explanation on hover and on keyboard focus (WCAG 1.4.13): it can be
 * dismissed with Escape, the pointer can move onto it without it vanishing, and it
 * stays until the reader moves away. It never carries information that is not also
 * somewhere a touch or keyboard reader can reach: touch devices do not open it.
 * It replaces the native `title` attribute, which does none of this.
 */
export function Tooltip({ label, children, side = "top", delay = 500, describe = true, disabled = false }: TooltipProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [timing] = useState(() => new Timing(setAnchor));

  useEffect(() => () => timing.clear(), [timing]);

  if (disabled) return children;

  const trigger = cloneElement(children, {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      children.props.onPointerEnter?.(event);
      if (event.pointerType !== "touch") timing.to(event.currentTarget, delay);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      children.props.onPointerLeave?.(event);
      timing.to(null, GRACE_MS);
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(event);
      let keyboard = true;
      try {
        keyboard = event.currentTarget.matches(":focus-visible");
      } catch {
        // A browser without :focus-visible: treat every focus as keyboard focus.
      }
      if (keyboard) timing.to(event.currentTarget, 0);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(event);
      timing.to(null, 0);
    },
    "aria-describedby": anchor && describe ? id : children.props["aria-describedby"],
  });

  return (
    <>
      {trigger}
      {anchor && (
        <Portal>
          <Bubble id={id} anchor={anchor} side={side} onEnter={() => timing.clear()} onLeave={() => timing.to(null, GRACE_MS)} onEscape={() => timing.to(null, 0)}>
            {label}
          </Bubble>
        </Portal>
      )}
    </>
  );
}

function Bubble({
  id,
  anchor,
  side,
  onEnter,
  onLeave,
  onEscape,
  children,
}: {
  id: string;
  anchor: HTMLElement;
  side: Side;
  onEnter: () => void;
  onLeave: () => void;
  onEscape: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayer({ open: true, modal: false, onEscape, elementRef: ref });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const options = { side, gap: 6, maxWidth: MAX_WIDTH, align: "center" as const };
    placeFloating(anchor, node, options);
    return trackFloating(anchor, node, options);
  }, [anchor, side]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className="fixed left-0 top-0 z-popover w-max rounded-2 bg-control px-2 py-1 text-caption text-on-control shadow-float"
    >
      {children}
    </div>
  );
}
