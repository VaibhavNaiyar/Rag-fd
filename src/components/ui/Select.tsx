"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { controlClasses, useFieldControl } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** A native select, drawn like the other controls. The browser's own picker opens, so it is right on a phone. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, invalid: _invalid, required, children, ...props }, ref) {
  const control = useFieldControl({ ...props, invalid: _invalid, required });
  const { invalid, ...attributes } = control;
  return (
    <div className="relative min-w-0">
      <select ref={ref} {...props} {...attributes} className={cn("h-control appearance-none pr-8", controlClasses(invalid), className)}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
    </div>
  );
});
