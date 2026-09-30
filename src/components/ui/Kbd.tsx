"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export type Platform = "apple" | "other";

/** Apple platforms show ⌘ where the others show Ctrl. Pure, so it is tested without a browser. */
export function platformOf(nav: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } }): Platform {
  const hint = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(hint) ? "apple" : "other";
}

const NEVER_CHANGES = () => () => undefined;

/**
 * The reader's platform. The server, and the first client render, say "other", so a
 * static export hydrates cleanly; a Mac then swaps Ctrl for ⌘ without a mismatch.
 */
export function usePlatform(): Platform {
  return useSyncExternalStore(NEVER_CHANGES, () => platformOf(navigator), () => "other" as Platform);
}

const KEY_NAMES: Record<Platform, Record<string, string>> = {
  apple: { mod: "⌘", shift: "⇧", alt: "⌥", enter: "↵", esc: "Esc", up: "↑", down: "↓", left: "←", right: "→" },
  other: { mod: "Ctrl", shift: "Shift", alt: "Alt", enter: "Enter", esc: "Esc", up: "↑", down: "↓", left: "←", right: "→" },
};

const SPOKEN: Record<Platform, Record<string, string>> = {
  apple: { mod: "Command", shift: "Shift", alt: "Option", enter: "Return", esc: "Escape", up: "Up arrow", down: "Down arrow", left: "Left arrow", right: "Right arrow" },
  other: { mod: "Control", shift: "Shift", alt: "Alt", enter: "Enter", esc: "Escape", up: "Up arrow", down: "Down arrow", left: "Left arrow", right: "Right arrow" },
};

export interface KbdProps {
  /** Key names in order: `["mod", "K"]`. `mod`, `shift`, `alt`, `enter`, `esc` and the four arrows are translated for the platform. */
  keys: readonly string[];
  /** Force a platform, for the kit page and the tests. Default: the reader's. */
  platform?: Platform;
  /** "chrome" for use on the navy bar. */
  surface?: "default" | "chrome";
  className?: string;
}

/** A keyboard shortcut hint. Read aloud as words ("Command K"), drawn as keycaps. */
export function Kbd({ keys, platform, surface = "default", className }: KbdProps) {
  const detected = usePlatform();
  const target = platform ?? detected;
  const spoken = keys.map((key) => SPOKEN[target][key.toLowerCase()] ?? key).join(" ");

  return (
    <span role="group" aria-label={spoken} className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          aria-hidden
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-1 border px-1 font-mono text-caption",
            surface === "chrome" ? "border-chrome-line bg-chrome-hover text-on-chrome-muted" : "border-line-strong bg-surface-2 text-ink-muted",
          )}
        >
          {KEY_NAMES[target][key.toLowerCase()] ?? key}
        </kbd>
      ))}
    </span>
  );
}
