import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's default scales. Ours are named, so without
 * this it reads `text-caption` as a colour and drops it whenever a colour class such
 * as `text-ink-muted` follows, and keeps two radii, two shadows or two z-indexes
 * side by side. The names below are the ones tailwind.config.ts defines.
 */
const twMerge = extendTailwindMerge({
  extend: {
    // The measure names added to `spacing` in tailwind.config.ts (h-control, w-nav, pt-safe-top …).
    theme: {
      spacing: ["control-sm", "control", "row", "row-compact", "hit", "topbar", "nav", "status", "tabbar", "gutter", "safe-top", "safe-right", "safe-bottom", "safe-left"],
    },
    classGroups: {
      "font-size": [{ text: ["caption", "label", "body", "heading", "title", "display", "trace"] }],
      rounded: [{ rounded: ["1", "2", "3", "pill"] }],
      shadow: [{ shadow: ["float", "overlay", "card", "lift"] }],
      z: [{ z: ["base", "sticky", "chrome", "sheet", "popover", "toast", "palette"] }],
      ease: [{ ease: ["standard", "oneui"] }],
    },
  },
});

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
