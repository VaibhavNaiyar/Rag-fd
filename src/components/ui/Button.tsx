"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "subtle" | "ghost" | "outline";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  // --ui-primary is 3.77:1 on white: legal as a fill behind white text.
  primary: "bg-primary text-white hover:brightness-110 active:brightness-95",
  subtle: "bg-sunken text-ink-body hover:bg-line",
  ghost: "bg-transparent text-ink-muted hover:bg-sunken hover:text-ink-body",
  outline: "border border-line bg-raised text-ink-body hover:border-primary hover:text-primary-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-caption gap-1.5",
  md: "h-10 px-4 text-label gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "subtle", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-pill font-medium",
        "transition-[background-color,color,border-color,filter] duration-150 ease-oneui",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
