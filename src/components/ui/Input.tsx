"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { controlClasses, useFieldControl } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Draw the error state. Inside a Field with an error this is already on. */
  invalid?: boolean;
}

/** A single-line text control. Inside a Field it is labelled and described by it. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid: _invalid, required, ...props }, ref) {
  const control = useFieldControl({ ...props, invalid: _invalid, required });
  const { invalid, ...attributes } = control;
  return <input ref={ref} {...props} {...attributes} className={cn("h-control", controlClasses(invalid), className)} />;
});
