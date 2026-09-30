"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type KeyboardEventHandler, type ReactNode, type RefObject } from "react";
import { Kbd } from "@/components/ui/Kbd";
import { Popover } from "@/components/ui/Popover";
import type { Align, Side } from "@/components/ui/position";
import { cn } from "@/lib/cn";

export type MenuEntry =
  | {
      type?: "item";
      id: string;
      label: string;
      /** A mark before the label. Hidden from assistive technology. */
      icon?: ReactNode;
      /** Muted text at the end of the row. */
      detail?: string;
      /** Keys, for a shortcut hint: `["mod", "K"]`. */
      shortcut?: readonly string[];
      disabled?: boolean;
      /** A destructive action: drawn in the error ink. */
      danger?: boolean;
      onSelect: () => void;
    }
  | { type: "separator"; id: string }
  | { type: "heading"; id: string; label: string };

export interface MenuTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
}

export interface MenuProps {
  /** The menu's accessible name. */
  label: string;
  items: readonly MenuEntry[];
  /** Renders the control that opens the menu; spread the props it is given onto a button. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  side?: Side;
  align?: Align;
}

const ITEMS = '[role="menuitem"]:not([aria-disabled="true"])';
const TYPEAHEAD_MS = 500;

/**
 * A menu of actions (WAI-ARIA menu button pattern). Enter, Space or Arrow Down on the
 * trigger opens it; Arrow keys, Home and End move between items; typing letters jumps
 * to the next item that starts with them; Enter or Space runs the item and closes the
 * menu; Escape closes it and returns focus to the trigger; Tab closes it and moves on.
 * It is anchored, flips and clamps to the viewport, so it never overflows at 375 px.
 */
export function Menu({ label, items, trigger, side = "bottom", align = "start" }: MenuProps) {
  const menuId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<"first" | "last">("first");

  const openAt = (where: "first" | "last") => {
    setStart(where);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAt("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt("last");
    }
  };

  return (
    <>
      {trigger({
        ref: anchorRef,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: () => (open ? setOpen(false) : openAt("first")),
        onKeyDown: onTriggerKeyDown,
      })}
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchorRef} label={label} role="none" initialFocus="container" side={side} align={align} className="min-w-40 max-w-80">
        <MenuList id={menuId} label={label} items={items} start={start} onClose={() => setOpen(false)} />
      </Popover>
    </>
  );
}

function MenuList({ id, label, items, start, onClose }: { id: string; label: string; items: readonly MenuEntry[]; start: "first" | "last"; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", timer: 0 });

  const enabled = (): HTMLElement[] => (ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>(ITEMS)) : []);

  // After the layer has taken and remembered the trigger's focus, move it onto an item.
  useEffect(() => {
    const list = enabled();
    (start === "last" ? list[list.length - 1] : list[0])?.focus({ preventScroll: true });
    const state = typed.current;
    return () => window.clearTimeout(state.timer);
  }, [start]);

  const move = (to: (list: HTMLElement[], at: number) => number) => {
    const list = enabled();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[to(list, at)]?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        return move((list, at) => (at + 1) % list.length);
      case "ArrowUp":
        event.preventDefault();
        return move((list, at) => (at <= 0 ? list.length - 1 : at - 1));
      case "Home":
        event.preventDefault();
        return move(() => 0);
      case "End":
        event.preventDefault();
        return move((list) => list.length - 1);
      case "Tab":
        // Let the browser move on from the trigger, where focus goes back to.
        return onClose();
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.key === " ") return;
    const state = typed.current;
    window.clearTimeout(state.timer);
    state.text += event.key.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.text = "";
    }, TYPEAHEAD_MS);

    const list = enabled();
    const current = list.indexOf(document.activeElement as HTMLElement);
    // A single letter looks from the next item on; a longer word keeps the current item in play.
    const from = state.text.length === 1 ? current + 1 : Math.max(current, 0);
    const ordered = [...list.slice(from), ...list.slice(0, from)];
    ordered.find((item) => (item.textContent ?? "").trim().toLowerCase().startsWith(state.text))?.focus({ preventScroll: true });
  };

  return (
    <div ref={ref} id={id} role="menu" aria-label={label} onKeyDown={onKeyDown} className="py-1">
      {items.map((entry) => {
        if (entry.type === "separator") return <div key={entry.id} role="separator" className="my-1 h-px bg-line" />;
        if (entry.type === "heading") {
          return (
            <div key={entry.id} role="presentation" className="px-3 pb-1 pt-2 text-caption text-ink-muted">
              {entry.label}
            </div>
          );
        }
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={entry.disabled || undefined}
            onClick={() => {
              if (entry.disabled) return;
              entry.onSelect();
              onClose();
            }}
            className={cn(
              "flex min-h-row w-full items-center gap-2 px-3 text-left text-label -outline-offset-2",
              entry.danger ? "text-error-ink" : "text-ink-body",
              entry.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-2 focus:bg-surface-2",
            )}
          >
            {entry.icon && (
              <span aria-hidden className="inline-flex shrink-0 items-center">
                {entry.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 break-words">{entry.label}</span>
            {entry.detail && <span className="shrink-0 text-caption text-ink-muted">{entry.detail}</span>}
            {entry.shortcut && <Kbd keys={entry.shortcut} />}
          </button>
        );
      })}
    </div>
  );
}
