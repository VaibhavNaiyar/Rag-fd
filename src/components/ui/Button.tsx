"use client";

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

/**
 * primary    the one main action of a view: Samsung Blue fill
 * neutral    a solid action that is not the main one: Deep Navy fill
 * secondary  an outlined action on a surface
 * ghost      a quiet action: no outline until hovered
 * danger     a destructive action: tinted, never a solid red field
 *
 * `subtle` and `outline` are the previous names, still accepted so the old screens
 * keep compiling; they are deleted with them in P12.
 */
export type ButtonVariant = "primary" | "neutral" | "secondary" | "ghost" | "danger" | "subtle" | "outline";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-on-accent enabled:hover:border-accent-hover enabled:hover:bg-accent-hover enabled:active:border-accent-press enabled:active:bg-accent-press",
  neutral:
    "border-control bg-control text-on-control enabled:hover:border-control-hover enabled:hover:bg-control-hover enabled:active:border-control-press enabled:active:bg-control-press",
  secondary: "border-line-control bg-surface text-ink enabled:hover:bg-surface-2 enabled:active:bg-surface-3",
  ghost: "border-transparent bg-transparent text-ink-body enabled:hover:bg-surface-2 enabled:active:bg-surface-3",
  danger: "border-error-edge bg-error-soft text-error-ink enabled:hover:border-error enabled:active:bg-surface-2",
  subtle: "border-line-control bg-surface text-ink enabled:hover:bg-surface-2 enabled:active:bg-surface-3",
  outline: "border-line-control bg-surface text-ink enabled:hover:bg-surface-2 enabled:active:bg-surface-3",
};

/** 28 and 32 px tall; both grow to 44 px on a touch screen (the control tokens do that). */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-control-sm gap-1 px-2",
  md: "h-control gap-2 px-3",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A mark before the label. Hidden from assistive technology. */
  icon?: ReactNode;
  /** Shows a spinner in place of the label and ignores clicks. The button keeps its width and its focus. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, loading = false, className, type = "button", children, onClick, ...props },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-2 border text-label transition-colors duration-1 ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {/* The label stays in the layout while loading, hidden, so the button does not change width. */}
      <span className={cn("inline-flex min-w-0 items-center justify-center", size === "sm" ? "gap-1" : "gap-2", loading && "invisible")}>
        {icon && (
          <span aria-hidden className="inline-flex shrink-0 items-center">
            {icon}
          </span>
        )}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner size="sm" label="Working" />
        </span>
      )}
    </button>
  );
});
