/**
 * Where a floating layer (menu, popover, tooltip) goes relative to what it is
 * anchored to. Pure arithmetic, no DOM, so the guarantee that matters is tested
 * directly: whatever the anchor and the size, the layer stays inside the viewport,
 * and it is given a maximum size so content that is too big scrolls or wraps
 * instead of overflowing. At 375 px that is the difference between a menu and a
 * horizontal scrollbar.
 *
 * Coordinates are viewport coordinates, for `position: fixed`.
 */

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PositionInput {
  /** The anchor's box, e.g. from getBoundingClientRect(). */
  anchor: Rect;
  /** The floating layer's natural size. */
  floating: Size;
  viewport: Size;
  /** Preferred side; the opposite side is used when this one has no room. Default "bottom". */
  side?: Side;
  /** Alignment along the anchor's edge. Default "start". */
  align?: Align;
  /** Space between anchor and layer. Default 4. */
  gap?: number;
  /** Space kept clear at the viewport edges. Default 8. */
  margin?: number;
}

export interface Position {
  left: number;
  top: number;
  /** The side actually used, after flipping. */
  side: Side;
  /** The layer must not be wider than this: it wraps or truncates beyond it. */
  maxWidth: number;
  /** The layer must not be taller than this: it scrolls beyond it. */
  maxHeight: number;
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), Math.max(low, high));

/** Room between the anchor and the viewport edge on one side, net of gap and margin. */
function roomOn(side: Side, anchor: Rect, viewport: Size, gap: number, margin: number): number {
  switch (side) {
    case "top":
      return anchor.top - gap - margin;
    case "bottom":
      return viewport.height - (anchor.top + anchor.height) - gap - margin;
    case "left":
      return anchor.left - gap - margin;
    case "right":
      return viewport.width - (anchor.left + anchor.width) - gap - margin;
  }
}

export function computePosition(input: PositionInput): Position {
  const { anchor, floating, viewport } = input;
  const gap = input.gap ?? 4;
  const margin = input.margin ?? 8;
  const align = input.align ?? "start";
  const preferred = input.side ?? "bottom";

  const vertical = (side: Side): boolean => side === "top" || side === "bottom";
  const need = (side: Side): number => (vertical(side) ? floating.height : floating.width);

  // Flip only when the preferred side is too small and the other side has more room.
  let side = preferred;
  const room = roomOn(preferred, anchor, viewport, gap, margin);
  const opposite = OPPOSITE[preferred];
  if (room < need(preferred) && roomOn(opposite, anchor, viewport, gap, margin) > room) side = opposite;

  const maxWidth = Math.max(0, viewport.width - 2 * margin);
  const maxHeight = Math.max(0, viewport.height - 2 * margin);
  // What the layer will actually measure once the maxima are applied.
  const width = Math.min(floating.width, maxWidth);
  const height = Math.min(floating.height, maxHeight);

  let left: number;
  let top: number;

  if (vertical(side)) {
    const along = align === "start" ? anchor.left : align === "end" ? anchor.left + anchor.width - width : anchor.left + (anchor.width - width) / 2;
    left = clamp(along, margin, viewport.width - margin - width);
    const space = Math.max(0, roomOn(side, anchor, viewport, gap, margin));
    const usable = Math.min(height, space > 0 ? space : height);
    top = side === "bottom" ? anchor.top + anchor.height + gap : anchor.top - gap - usable;
    top = clamp(top, margin, viewport.height - margin - usable);
    return { left, top, side, maxWidth, maxHeight: Math.max(0, Math.min(maxHeight, space > 0 ? space : maxHeight)) };
  }

  const along = align === "start" ? anchor.top : align === "end" ? anchor.top + anchor.height - height : anchor.top + (anchor.height - height) / 2;
  top = clamp(along, margin, viewport.height - margin - height);
  const space = Math.max(0, roomOn(side, anchor, viewport, gap, margin));
  const usable = Math.min(width, space > 0 ? space : width);
  left = side === "right" ? anchor.left + anchor.width + gap : anchor.left - gap - usable;
  left = clamp(left, margin, viewport.width - margin - usable);
  return { left, top, side, maxWidth: Math.max(0, Math.min(maxWidth, space > 0 ? space : maxWidth)), maxHeight };
}
