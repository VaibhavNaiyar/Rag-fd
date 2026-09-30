"use client";

import { OctagonAlert } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: string;
  /** Help text under the label. Read after the label when the control takes focus. */
  description?: string;
  /** The reason the value is wrong. Shown with an icon, and read out when it appears. */
  error?: string;
  required?: boolean;
  /** Keep the label for assistive technology but do not draw it (a search box next to a heading). */
  hideLabel?: boolean;
  className?: string;
  /** An Input, Textarea or Select. They find their id, description and error here. */
  children: ReactNode;
}

/**
 * A labelled form control. It owns the ids: the label points at the control, and the
 * description and the error are attached to it with aria-describedby, so a screen
 * reader says all three when the control is focused. An invalid field says so with an
 * icon and words, not with a red border alone.
 */
export function Field({ label, description, error, required = false, hideLabel = false, className, children }: FieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex min-w-0 flex-col gap-1", className)}>
        <label htmlFor={id} className={cn("text-label text-ink", hideLabel && "sr-only")}>
          {label}
          {required && (
            <span aria-hidden className="text-error-ink">
              {" "}
              *
            </span>
          )}
        </label>
        {description && (
          <p id={descriptionId} className="text-caption text-ink-muted">
            {description}
          </p>
        )}
        {children}
        {error && (
          <p id={errorId} role="alert" className="flex items-start gap-1 text-caption text-error-ink">
            <OctagonAlert size={14} aria-hidden className="mt-px shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

interface ControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  invalid?: boolean;
  required?: boolean;
}

/** What a control takes from the Field around it, for the attributes it should set. Used by Input, Textarea and Select. */
export function useFieldControl(props: ControlProps) {
  const field = useContext(FieldContext);
  const describedBy = [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  const invalid = props.invalid ?? field?.invalid ?? false;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (invalid ? true : undefined),
    "aria-required": (props.required ?? field?.required) ? true : undefined,
    invalid,
  };
}

/** 32 px tall (44 on a touch screen), a control-coloured outline that reaches 3:1, and the error colour when invalid. */
export function controlClasses(invalid: boolean): string {
  return cn(
    "w-full min-w-0 rounded-2 border bg-surface px-3 text-body text-ink placeholder:text-ink-muted",
    "disabled:cursor-not-allowed disabled:opacity-50",
    invalid ? "border-error" : "border-line-control",
  );
}
