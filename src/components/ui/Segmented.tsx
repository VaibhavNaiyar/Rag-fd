"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** A mark before the label. Hidden from assistive technology. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  /** The group's accessible name: "Density", "Lens". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** 28 px or 32 px tall; both are 44 px on a touch screen. Default "sm". */
  size?: "sm" | "md";
  className?: string;
}

/**
 * A small exclusive choice: density, lens, sort direction. It is a radio group, so
 * it is one tab stop; the arrow keys move between options and choose them, Home and
 * End go to the ends. Labels shrink and truncate rather than widen the row.
 */
export function Segmented<T extends string>({ label, options, value, onValueChange, size = "sm", className }: SegmentedProps<T>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter((option) => !option.disabled);
    if (enabled.length === 0) return;
    const at = enabled.findIndex((option) => option.value === value);
    let next: SegmentedOption<T> | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = enabled[(at + 1) % enabled.length];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = enabled[at <= 0 ? enabled.length - 1 : at - 1];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    else return;

    event.preventDefault();
    if (!next) return;
    onValueChange(next.value);
    const target = next.value;
    Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-value]"))
      .find((button) => button.dataset.value === target)
      ?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn("inline-flex max-w-full min-w-0 rounded-2 border border-line-control p-px", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={option.value}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1 rounded-1 px-3 text-label transition-colors duration-1 ease-standard",
              size === "sm" ? "h-control-sm" : "h-control",
              selected ? "bg-accent-soft text-accent-ink" : "text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink",
              option.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {option.icon && (
              <span aria-hidden className="inline-flex shrink-0 items-center">
                {option.icon}
              </span>
            )}
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
