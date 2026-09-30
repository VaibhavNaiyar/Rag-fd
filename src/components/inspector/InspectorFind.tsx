"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { LiveRegion } from "@/components/ui/a11y";

export interface InspectorFindProps {
  /** The Inspector's own DOM subtree — `⌘/Ctrl+F` is intercepted only while it holds focus, and every match is scoped to it. */
  containerRef: RefObject<HTMLElement | null>;
}

const LEAF_SELECTOR = "p, span, dt, dd, td, th, li, button, figcaption";

/** The most specific elements matching `query` — an element whose own text matches but none of whose descendants also match, so a match is not reported once for a whole row and again for every cell inside it. */
function findMatches(root: HTMLElement, query: string): HTMLElement[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const candidates = [...root.querySelectorAll<HTMLElement>(LEAF_SELECTOR)].filter((el) => (el.textContent ?? "").toLowerCase().includes(needle));
  return candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other)));
}

/**
 * Scoped find within the Inspector (P7-F14). `⌘/Ctrl+F` opens it only when
 * the keypress originates inside `containerRef` — the listener is attached to
 * that element, not `window`, so the browser's own page find still works
 * everywhere else.
 */
export function InspectorFind({ containerRef }: InspectorFindProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(0);
  const [matches, setMatches] = useState<HTMLElement[]>([]);

  // Reading the DOM (an external system) in response to the query or the panel opening — not a
  // pure re-derivation of props, so this is the sanctioned use of an effect, not the "you might
  // not need an effect" case. Matches and the index reset together, in one state update.
  useEffect(() => {
    const node = containerRef.current;
    setMatches(open && node ? findMatches(node, query) : []);
    setIndex(0);
  }, [open, query, containerRef]);

  useEffect(() => {
    matches.forEach((el, at) => el.classList.toggle("inspector-find-current", at === index));
    return () => matches.forEach((el) => el.classList.remove("inspector-find-current"));
  }, [matches, index]);

  useEffect(() => {
    matches[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [matches, index]);

  const openFind = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFind();
      } else if (event.key === "Escape" && open) {
        setOpen(false);
      }
    };
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [containerRef, open, openFind]);

  const step = (delta: number) => {
    if (matches.length === 0) return;
    setIndex((current) => (current + delta + matches.length) % matches.length);
  };

  if (!open) {
    return <IconButton label="Find in Inspector (⌘/Ctrl+F)" size="sm" icon={<Search size={14} aria-hidden />} onClick={openFind} />;
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") step(event.shiftKey ? -1 : 1);
        }}
        placeholder="Find in Inspector"
        aria-label="Find in Inspector"
        className="h-control-sm w-32"
      />
      <span className="shrink-0 font-mono text-caption tabular text-ink-muted">{matches.length === 0 ? "0/0" : `${index + 1}/${matches.length}`}</span>
      <IconButton label="Previous match" size="sm" icon={<ChevronUp size={13} aria-hidden />} onClick={() => step(-1)} disabled={matches.length === 0} />
      <IconButton label="Next match" size="sm" icon={<ChevronDown size={13} aria-hidden />} onClick={() => step(1)} disabled={matches.length === 0} />
      <IconButton
        label="Close find"
        size="sm"
        icon={<X size={13} aria-hidden />}
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
      />
      <LiveRegion politeness="polite" className="sr-only">
        {query ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : ""}
      </LiveRegion>
    </div>
  );
}
