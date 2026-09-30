"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { INSPECTOR } from "@/lib/layout";

export interface PaneResizerProps {
  /** The Inspector's current width in px. */
  value: number;
  min: number;
  max: number;
  /** Where a double click puts it back. */
  defaultValue: number;
  onChange: (value: number) => void;
  label?: string;
}

/**
 * The handle between the view and a docked Inspector: a 1 px line with a 9 px target,
 * `role="separator"`, which is what a keyboard reader needs to find and use it. It is
 * one tab stop. Left and Right change the width by 16 px (Left widens the Inspector: the
 * handle moves left), Home and End go to the least and the most, a double click resets
 * it. A pointer drag is captured, so it keeps working when the pointer leaves the
 * handle. Every width is held between `min` and `max`. Below 1024 px there is no docked
 * Inspector, so there is no handle.
 */
export function PaneResizer({ value, min, max, defaultValue, onChange, label = "Resize the inspector" }: PaneResizerProps) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const clamp = (width: number) => Math.min(Math.max(Math.round(width), min), max);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    if (event.key === "ArrowLeft") next = value + INSPECTOR.step;
    else if (event.key === "ArrowRight") next = value - INSPECTOR.step;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault();
    onChange(clamp(next));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, width: value };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start) onChange(clamp(start.width - (event.clientX - start.x)));
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${value} pixels wide`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => onChange(clamp(defaultValue))}
      className="relative z-chrome w-px cursor-col-resize touch-none bg-line-strong transition-colors duration-1 ease-standard hover:bg-accent"
    >
      <span aria-hidden className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
