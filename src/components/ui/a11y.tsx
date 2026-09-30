"use client";

import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ensureLayerRoot } from "@/components/ui/Portal";

/** Text that is there for assistive technology and takes no room on screen. */
export function VisuallyHidden({ as: Tag = "span", children }: { as?: ElementType; children: ReactNode }) {
  return <Tag className="sr-only">{children}</Tag>;
}

/**
 * The first tab stop on the page: jumps to the main content. It is invisible until
 * it has focus. The target needs `tabIndex={-1}` so it can take focus, and the link
 * does not change the URL hash, which the router owns.
 */
export function SkipLink({ targetId, children = "Skip to main content" }: { targetId: string; children?: ReactNode }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        target.focus();
      }}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-palette",
        "focus:rounded-2 focus:border focus:border-line-control focus:bg-surface focus:px-3 focus:py-2",
        "focus:text-label focus:text-ink focus:shadow-float",
      )}
    >
      {children}
    </a>
  );
}

export type Politeness = "polite" | "assertive";

/**
 * A live region that is always in the document, so what changes inside it is
 * announced. `polite` waits for the reader to finish; `assertive` interrupts.
 */
export function LiveRegion({
  politeness = "polite",
  atomic = true,
  className,
  children,
}: {
  politeness?: Politeness;
  atomic?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div role={politeness === "assertive" ? "alert" : "status"} aria-live={politeness} aria-atomic={atomic} className={className}>
      {children}
    </div>
  );
}

const regions: Partial<Record<Politeness, HTMLElement>> = {};

function regionFor(politeness: Politeness): HTMLElement {
  const existing = regions[politeness];
  if (existing?.isConnected) return existing;
  const element = document.createElement("div");
  element.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  element.setAttribute("aria-live", politeness);
  element.setAttribute("aria-atomic", "true");
  element.className = "sr-only";
  ensureLayerRoot().appendChild(element);
  regions[politeness] = element;
  return element;
}

/**
 * Says something to a screen reader without showing it. The two regions live in the
 * layer root, which is never made inert, so this works from inside a sheet too.
 * Saying the same thing twice in a row still announces twice.
 */
export function announce(message: string, politeness: Politeness = "polite"): void {
  if (typeof document === "undefined") return;
  const region = regionFor(politeness);
  if (region.textContent === message) {
    region.textContent = "";
    window.requestAnimationFrame(() => {
      region.textContent = message;
    });
    return;
  }
  region.textContent = message;
}

const ANNOUNCER = { announce } as const;

/** `const { announce } = useAnnouncer()`. The object never changes, so it is safe in dependency lists. */
export function useAnnouncer(): typeof ANNOUNCER {
  return ANNOUNCER;
}
