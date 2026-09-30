"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type FormEvent, type TextareaHTMLAttributes } from "react";
import { controlClasses, useFieldControl } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Rows shown when empty. Default 2. */
  minRows?: number;
  /** The height stops growing here and scrolls. Default 8. */
  maxRows?: number;
}

/** Sizes a textarea to its content, up to `maxRows`. Only writes to the element's own style. */
export function fitTextarea(element: HTMLTextAreaElement, maxRows: number): void {
  const style = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight) || 20;
  const chrome =
    Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  const limit = maxRows * lineHeight + (Number.isFinite(chrome) ? chrome : 0);

  element.style.height = "auto";
  const wanted = element.scrollHeight + (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
  element.style.height = `${Math.min(wanted, limit)}px`;
  element.style.overflowY = wanted > limit ? "auto" : "hidden";
}

/** A multi-line text control that grows with what is typed, up to a limit, then scrolls. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid: _invalid, required, minRows = 2, maxRows = 8, onInput, value, ...props },
  forwardedRef,
) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => inner.current as HTMLTextAreaElement);
  const control = useFieldControl({ ...props, invalid: _invalid, required });
  const { invalid, ...attributes } = control;

  // A value set from outside (a cleared composer) changes the height too.
  useLayoutEffect(() => {
    if (inner.current) fitTextarea(inner.current, maxRows);
  }, [value, maxRows]);

  return (
    <textarea
      ref={inner}
      rows={minRows}
      value={value}
      {...props}
      {...attributes}
      onInput={(event: FormEvent<HTMLTextAreaElement>) => {
        fitTextarea(event.currentTarget, maxRows);
        onInput?.(event);
      }}
      className={cn("resize-none py-2", controlClasses(invalid), className)}
    />
  );
});
