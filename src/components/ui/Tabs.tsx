"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Menu } from "@/components/ui/Menu";
import { splitTabs } from "@/components/ui/tabsLayout";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  /** A number after the label, in the monospace face. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  /** The tab list's accessible name. */
  label: string;
  items: readonly TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** "underline" for the view's own sections; "segmented" for a compact switch. Default "underline". */
  variant?: "underline" | "segmented";
  /** Ties tabs to their panels: the same prefix goes to each TabPanel. Default: generated. */
  idPrefix?: string;
  /** Point each tab at its panel with aria-controls. Turn it off when there are no TabPanels, so nothing points at a missing element. Default true. */
  controls?: boolean;
  className?: string;
}

export const tabDomId = (prefix: string, id: string): string => `${prefix}-tab-${id}`;
export const panelDomId = (prefix: string, id: string): string => `${prefix}-panel-${id}`;

const BASE = "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-label transition-colors duration-1 ease-standard";

function tabClasses(variant: "underline" | "segmented", selected: boolean, disabled?: boolean): string {
  return cn(
    BASE,
    variant === "underline" ? "h-row px-3" : "h-control-sm rounded-1 px-3",
    disabled && "cursor-not-allowed opacity-50",
    variant === "underline"
      ? selected
        ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent"
        : "text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink"
      : selected
        ? "bg-accent-soft text-accent-ink"
        : "text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink",
  );
}

function Label({ item }: { item: TabItem }): ReactNode {
  return (
    <>
      <span className="min-w-0 truncate">{item.label}</span>
      {item.count !== undefined && <span className="font-mono text-caption tabular text-ink-muted">{item.count}</span>}
    </>
  );
}

/**
 * Tabs (WAI-ARIA tabs pattern, automatic activation): one tab stop, Left and Right
 * move between tabs and select them, Home and End go to the first and last. Tabs that
 * do not fit are moved into a "More" menu rather than scrolled sideways, and the
 * selected tab always stays in view. Pair each tab with a TabPanel using the same prefix.
 */
export function Tabs({ label, items, value, onValueChange, variant = "underline", idPrefix, controls = true, className }: TabsProps) {
  const generated = useId();
  const prefix = idPrefix ?? generated;
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([]);

  // Measure every tab at its natural width in a hidden copy, and choose what fits. Runs
  // from a ResizeObserver, so it follows the container as it is resized or dragged.
  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || typeof ResizeObserver === "undefined") return;

    const run = () => {
      const widths = Array.from(measure.querySelectorAll<HTMLElement>("[data-measure-tab]")).map((tab) => tab.getBoundingClientRect().width);
      const moreWidth = measure.querySelector<HTMLElement>("[data-measure-more]")?.getBoundingClientRect().width ?? 0;
      const { overflow } = splitTabs({
        widths,
        available: container.clientWidth,
        moreWidth,
        selectedIndex: items.findIndex((item) => item.id === value),
      });
      const ids = overflow.map((index) => items[index]?.id ?? "");
      setHiddenIds((previous) => (previous.length === ids.length && previous.every((id, at) => id === ids[at]) ? previous : ids));
    };

    const observer = new ResizeObserver(run);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [items, value]);

  const shown = items.filter((item) => !hiddenIds.includes(item.id));
  const overflowed = items.filter((item) => hiddenIds.includes(item.id));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = shown.filter((item) => !item.disabled);
    if (enabled.length === 0) return;
    const at = enabled.findIndex((item) => item.id === value);
    let next: TabItem | undefined;
    if (event.key === "ArrowRight") next = enabled[(at + 1) % enabled.length];
    else if (event.key === "ArrowLeft") next = enabled[at <= 0 ? enabled.length - 1 : at - 1];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    else return;

    event.preventDefault();
    if (!next) return;
    onValueChange(next.id);
    document.getElementById(tabDomId(prefix, next.id))?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative flex min-w-0 items-center", variant === "underline" ? "border-b border-line" : "", className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn("flex min-w-0 overflow-hidden", variant === "segmented" && "rounded-2 border border-line-control p-px")}
      >
        {shown.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              id={tabDomId(prefix, item.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={controls ? panelDomId(prefix, item.id) : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.id)}
              className={tabClasses(variant, selected, item.disabled)}
            >
              <Label item={item} />
            </button>
          );
        })}
      </div>

      {overflowed.length > 0 && (
        <Menu
          label="More tabs"
          align="end"
          items={overflowed.map((item) => ({
            id: item.id,
            label: item.count === undefined ? item.label : `${item.label} (${item.count})`,
            disabled: item.disabled,
            onSelect: () => onValueChange(item.id),
          }))}
          trigger={(props) => (
            <button {...props} type="button" className={cn(tabClasses(variant, false), "shrink-0")}>
              More
              <ChevronDown size={14} aria-hidden />
            </button>
          )}
        />
      )}

      {/* The measuring copy: same tabs, natural width, invisible and out of the tab order. */}
      <div ref={measureRef} aria-hidden inert className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden">
        <div className="flex w-max">
          {items.map((item) => (
            <span key={item.id} data-measure-tab className={tabClasses(variant, item.id === value, item.disabled)}>
              <Label item={item} />
            </span>
          ))}
          <span data-measure-more className={cn(tabClasses(variant, false), "shrink-0")}>
            More
            <ChevronDown size={14} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  tabId: string;
  active: boolean;
  /** Keep the content mounted, hidden, while inactive. Default false: it is mounted only while shown. */
  keepMounted?: boolean;
  className?: string;
  children: ReactNode;
}

/** The content of one tab. It is one tab stop, so a keyboard reader can reach a panel with nothing focusable in it. */
export function TabPanel({ idPrefix, tabId, active, keepMounted = false, className, children }: TabPanelProps) {
  return (
    <div role="tabpanel" id={panelDomId(idPrefix, tabId)} aria-labelledby={tabDomId(idPrefix, tabId)} hidden={!active} tabIndex={0} className={cn("min-w-0", className)}>
      {active || keepMounted ? children : null}
    </div>
  );
}
