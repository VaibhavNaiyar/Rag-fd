import { computePosition, type Align, type Side } from "@/components/ui/position";

export interface PlaceOptions {
  side?: Side;
  align?: Align;
  gap?: number;
  margin?: number;
  /** A cap on the layer's width, in px, applied on top of the viewport limit (a tooltip is never wider than 320). */
  maxWidth?: number;
  /** Make the layer at least as wide as its anchor (a menu under a button). */
  matchAnchorWidth?: boolean;
}

/**
 * Puts `floating` next to `anchor` with position: fixed. The layer must already be
 * `position: fixed` and in the document. It measures the layer at its natural size,
 * asks computePosition where it fits, and writes left, top and the size limits.
 * Imperative on purpose: it runs from a layout effect, before paint, so the layer
 * never appears in the wrong place for a frame, and it needs no React state.
 */
export function placeFloating(anchor: HTMLElement, floating: HTMLElement, options: PlaceOptions = {}): void {
  const margin = options.margin ?? 8;
  // clientWidth excludes a vertical scrollbar; it is 0 where nothing has been laid out, so fall back to the window.
  const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
  const box = anchor.getBoundingClientRect();
  const cap = Math.min(options.maxWidth ?? Number.POSITIVE_INFINITY, Math.max(0, viewport.width - 2 * margin));

  // Measure at the natural size: from the origin, with only the width cap applied.
  floating.style.left = "0px";
  floating.style.top = "0px";
  floating.style.maxHeight = "";
  floating.style.minWidth = options.matchAnchorWidth ? `${Math.min(box.width, cap)}px` : "";
  floating.style.maxWidth = `${cap}px`;

  const size = { width: floating.offsetWidth, height: floating.offsetHeight };
  const place = computePosition({ anchor: box, floating: size, viewport, side: options.side, align: options.align, gap: options.gap, margin });

  floating.style.left = `${Math.round(place.left)}px`;
  floating.style.top = `${Math.round(place.top)}px`;
  floating.style.maxWidth = `${Math.min(cap, place.maxWidth)}px`;
  floating.style.maxHeight = `${place.maxHeight}px`;
  floating.dataset.side = place.side;
}

/**
 * Keeps a placed layer in the right place while the page changes under it: scrolling
 * (of any ancestor), resizing the window, and the layer or its anchor changing size.
 * Returns the function that stops. Work is batched to one placement per frame.
 */
export function trackFloating(anchor: HTMLElement, floating: HTMLElement, options: PlaceOptions = {}): () => void {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (anchor.isConnected && floating.isConnected) placeFloating(anchor, floating, options);
    });
  };

  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  observer?.observe(anchor);
  observer?.observe(floating);

  return () => {
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    observer?.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
  };
}
