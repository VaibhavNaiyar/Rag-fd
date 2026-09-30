"use client";

import type { KeyboardEvent } from "react";
import { VIEW_META } from "@/components/shell/views";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { VIEWS, formatRoute, viewRoute, type View } from "@/lib/route";

/**
 * The views, as a 56 px rail on the navy chrome, from 768 px up (below that the tab bar
 * does the job). Each is a real link to its hash route, so it works without a click
 * handler and the address bar follows. The rail is one tab stop, on the current view;
 * Up and Down (and Home and End) move between the views. The label is the accessible
 * name and a tooltip; the current view is `aria-current`, marked by a bar as well as a fill.
 */
export function NavRail({ active }: { active: View }) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    let to: HTMLAnchorElement | undefined;
    if (event.key === "ArrowDown") to = links[(at + 1) % links.length];
    else if (event.key === "ArrowUp") to = links[at <= 0 ? links.length - 1 : at - 1];
    else if (event.key === "Home") to = links[0];
    else if (event.key === "End") to = links[links.length - 1];
    else return;
    event.preventDefault();
    to?.focus();
  };

  return (
    <nav aria-label="Views" data-surface="chrome" onKeyDown={onKeyDown} className="frame-nav hidden flex-col items-center gap-1 border-r border-chrome-line bg-chrome pb-2 pl-safe-left pt-2 md:flex">
      {VIEWS.map((view) => {
        const { label, icon: Icon } = VIEW_META[view];
        const current = view === active;
        return (
          <Tooltip key={view} label={label} side="right" describe={false}>
            <a
              href={formatRoute(viewRoute(view))}
              aria-label={label}
              aria-current={current ? "page" : undefined}
              tabIndex={current ? 0 : -1}
              className={cn(
                "relative flex size-hit items-center justify-center rounded-2 transition-colors duration-1 ease-standard",
                current ? "bg-chrome-hover text-on-chrome before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-focus-chrome" : "text-on-chrome-muted hover:bg-chrome-hover hover:text-on-chrome",
              )}
            >
              <Icon size={18} aria-hidden />
            </a>
          </Tooltip>
        );
      })}
    </nav>
  );
}
