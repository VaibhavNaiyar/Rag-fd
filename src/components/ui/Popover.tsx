"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEventHandler, type ReactNode, type RefObject } from "react";
import { placeFloating, trackFloating, type PlaceOptions } from "@/components/ui/floating";
import { captureFocus, focusInside } from "@/components/ui/focus";
import { Portal, useLayer } from "@/components/ui/Portal";
import { cn } from "@/lib/cn";

export interface PopoverProps extends PlaceOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element the layer hangs from. A press on it is not an outside press, so its own toggle works. */
  anchorRef: RefObject<HTMLElement | null>;
  /** The layer's accessible name. */
  label: string;
  /** "dialog" for a panel of content; "none" when the children supply their own role (a menu). Default "dialog". */
  role?: "dialog" | "none";
  id?: string;
  /** Where focus goes when it opens: the first tabbable element, the layer itself, or nowhere. Default "first". */
  initialFocus?: "first" | "container" | "none";
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}

/**
 * A panel anchored to a control: it opens beside it, flips to the other side when
 * there is no room, and is clamped to the viewport with a width and height limit, so
 * at 375 px it can never widen the page. Not modal: the page behind stays live.
 *
 * Escape closes it (only if it is the top layer), so does a press anywhere outside it
 * and its anchor, and focus goes back to where it was unless the reader moved it on.
 */
export function Popover(props: PopoverProps) {
  return props.open ? (
    <Portal>
      <PopoverLayer {...props} />
    </Portal>
  ) : null;
}

function PopoverLayer({
  onOpenChange,
  anchorRef,
  label,
  role = "dialog",
  id,
  initialFocus = "first",
  className,
  onKeyDown,
  children,
  side,
  align,
  gap,
  margin,
  maxWidth,
  matchAnchorWidth,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onOpenChange);
  useEffect(() => {
    latest.current = onOpenChange;
  });

  useLayer({ open: true, modal: false, onEscape: () => latest.current(false), elementRef: ref });

  useLayoutEffect(() => {
    const node = ref.current;
    const anchor = anchorRef.current;
    if (!node || !anchor) return;
    const options = { side, align, gap, margin, maxWidth, matchAnchorWidth };
    placeFloating(anchor, node, options);
    return trackFloating(anchor, node, options);
  }, [anchorRef, side, align, gap, margin, maxWidth, matchAnchorWidth]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const restore = captureFocus();
    if (initialFocus === "first") focusInside(node);
    else if (initialFocus === "container") node.focus({ preventScroll: true });
    // Give focus back only if it is still in here (or nowhere): a press on another field must keep its focus.
    return () => restore((active) => !active || active === document.body || node.contains(active));
  }, [initialFocus]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      latest.current(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [anchorRef]);

  return (
    <div
      ref={ref}
      id={id}
      role={role === "none" ? undefined : "dialog"}
      aria-label={role === "none" ? undefined : label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn("fixed left-0 top-0 z-popover w-max overflow-y-auto rounded-2 bg-surface text-ink-body shadow-float outline-none", className)}
    >
      {children}
    </div>
  );
}
