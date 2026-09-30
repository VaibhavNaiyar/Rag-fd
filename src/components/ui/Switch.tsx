"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  /** Required: what the switch turns on. */
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * An on/off setting that takes effect at once (`role="switch"`). Space toggles it.
 * The whole row, label included, is the target, and the row is 44 px tall on a touch
 * screen. The position of the knob says on or off as well as the colour does.
 */
export function Switch({ label, checked, onCheckedChange, description, disabled = false, className }: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <label className={cn("inline-flex min-h-control max-w-full min-w-0 items-center gap-3 text-body text-ink-body", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-3 border transition-colors duration-1 ease-standard",
          checked ? "border-accent bg-accent" : "border-line-control bg-surface-3",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-px top-px size-4 rounded-2 transition-transform duration-1 ease-standard",
            checked ? "translate-x-4 bg-on-accent" : "translate-x-0 bg-ink-muted",
          )}
        />
      </button>
      <span className="min-w-0 break-words">
        <span id={labelId}>{label}</span>
        {description && (
          <span id={descriptionId} className="block text-caption text-ink-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
