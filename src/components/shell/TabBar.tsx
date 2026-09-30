"use client";

import { VIEW_META } from "@/components/shell/views";
import { cn } from "@/lib/cn";
import { VIEWS, formatRoute, viewRoute, type View } from "@/lib/route";

/**
 * The views, as a bar along the bottom of a phone (below 768 px): three tabs, each
 * the full 56 px of the bar (more than the 44 px a thumb needs) and a third of its
 * width, with the icon and the name. The bar pads itself by the home indicator, so the
 * tabs are never under it. From 768 px the nav rail replaces it. The current view is
 * `aria-current`, marked by a bar and a colour, and its label is always shown.
 */
export function TabBar({ active }: { active: View }) {
  return (
    <nav aria-label="Views" className="frame-bottom border-t border-line bg-surface pb-safe-bottom pl-safe-left pr-safe-right md:hidden">
      <ul className="m-0 flex h-tabbar list-none p-0">
        {VIEWS.map((view) => {
          const { label, icon: Icon } = VIEW_META[view];
          const current = view === active;
          return (
            <li key={view} className="min-w-0 flex-1">
              <a
                href={formatRoute(viewRoute(view))}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-full min-h-hit flex-col items-center justify-center gap-1 text-caption transition-colors duration-1 ease-standard",
                  current ? "text-accent-ink before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon size={20} aria-hidden />
                <span>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
