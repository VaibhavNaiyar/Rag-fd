"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { announce } from "@/components/ui/a11y";
import { Button } from "@/components/ui/Button";
import { copyText } from "@/components/ui/clipboard";
import { IconButton } from "@/components/ui/IconButton";

export interface CopyButtonProps {
  /** What goes on the clipboard. */
  value: string;
  /** The button's name: "Copy session id". Say what is copied. Default "Copy". */
  label?: string;
  /** Said to a screen reader on success. Default "Copied". */
  copiedMessage?: string;
  /** "icon" is an icon-only button with a tooltip; "text" shows the label. Default "icon". */
  variant?: "icon" | "text";
  /** "xs" is for a 24 px strip; the text variant has no such size and uses "sm". */
  size?: "xs" | "sm" | "md";
  /** For the icon variant on the navy chrome. */
  surface?: "default" | "chrome";
}

const CONFIRMATION_MS = 1500;

/**
 * Copies a value and says so. The confirmation is a live-region announcement, so it
 * reaches a screen reader, and the icon changes to a check mark for a moment, so it
 * reaches everyone else. The button's name does not change: it stays "Copy session id".
 * A copy the browser refuses is announced as a failure, not silently dropped.
 */
export function CopyButton({ value, label = "Copy", copiedMessage = "Copied", variant = "icon", size = "sm", surface = "default" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    if (await copyText(value)) {
      announce(copiedMessage);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), CONFIRMATION_MS);
    } else {
      announce("Copy failed", "assertive");
    }
  };

  const icon = copied ? <Check size={14} /> : <Copy size={14} />;

  return variant === "icon" ? (
    <IconButton label={label} icon={icon} size={size} surface={surface} onClick={onClick} />
  ) : (
    <Button variant="secondary" size={size === "xs" ? "sm" : size} icon={icon} onClick={onClick}>
      {copied ? copiedMessage : label}
    </Button>
  );
}
