"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "aria-pressed" | "title"> {
  /** Required: an icon-only control has no other name. Also the tooltip text. */
  label: string;
  icon: ReactNode;
  /**
   * Make this a toggle. `aria-pressed` is written only when this is given, so a
   * plain button is never announced as a toggle that is "not pressed".
   */
  pressed?: boolean;
  /** @deprecated The previous name of `pressed`; removed with the old screens in P12. */
  active?: boolean;
  /** 24 px (a dense strip), 28 px or 32 px. The last two are 44 px on a touch screen; the 24 px one is not, so use it only where 24 px is the row. */
  size?: "xs" | "sm" | "md";
  /** Sits on the navy chrome (top bar, nav rail). */
  surface?: "default" | "chrome";
  /** Show the label as a tooltip. Default true. */
  tooltip?: boolean;
}

/**
 * A button that is only an icon. The label is the accessible name and the tooltip,
 * so the tooltip does not also describe the button (that would read the name twice).
 * The touch target is 44 px; the drawn control is 32 px on a pointer that can aim.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, pressed, active, size = "md", surface = "default", tooltip = true, className, type = "button", ...props },
  ref,
) {
  const isPressed = pressed ?? active;
  const chrome = surface === "chrome";

  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={isPressed}
      data-surface={chrome ? "chrome" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2 transition-colors duration-1 ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "xs" ? "size-status" : size === "sm" ? "size-control-sm" : "size-control",
        chrome
          ? isPressed
            ? "bg-chrome-hover text-on-chrome"
            : "text-on-chrome-muted enabled:hover:bg-chrome-hover enabled:hover:text-on-chrome"
          : isPressed
            ? "bg-accent-soft text-accent-ink"
            : "text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink-body",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="inline-flex items-center justify-center">
        {icon}
      </span>
    </button>
  );

  return tooltip ? (
    <Tooltip label={label} describe={false}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
