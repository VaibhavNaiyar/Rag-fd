"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps {
  /** Required: what is being chosen. */
  label: string;
  checked: boolean;
  /** Some, not all, of a group are chosen. Shown as a dash; announced as "mixed". */
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  /** Keep the label for assistive technology but do not draw it (a "select all" box in a table header). */
  hideLabel?: boolean;
  className?: string;
}

/**
 * A native checkbox, drawn as a 16 px box. The native input is what gets focus and
 * keys (Space toggles it), so it behaves as the platform's does; the whole row is the
 * target, 44 px tall on a touch screen. A check mark or a dash says the state as well
 * as the fill colour does.
 */
export function Checkbox({ label, checked, indeterminate = false, onCheckedChange, description, disabled = false, hideLabel = false, className }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  const descriptionId = useId();

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const filled = checked || indeterminate;

  return (
    <label className={cn("inline-flex min-h-control max-w-full min-w-0 items-center gap-3 text-body text-ink-body", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", className)}>
      <span className="relative inline-flex size-4 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 size-full cursor-[inherit] opacity-0"
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none flex size-4 items-center justify-center rounded-1 border text-on-accent transition-colors duration-1 ease-standard",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
            filled ? "border-accent bg-accent" : "border-line-control bg-surface",
          )}
        >
          {indeterminate ? <Minus size={12} strokeWidth={3} /> : checked ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      </span>
      <span className={cn("min-w-0 break-words", hideLabel && "sr-only")}>
        {label}
        {description && (
          <span id={descriptionId} className="block text-caption text-ink-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
