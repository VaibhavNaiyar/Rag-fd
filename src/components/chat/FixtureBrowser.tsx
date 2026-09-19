"use client";

import { ChevronDown, Play, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { FIXTURE_FAMILIES } from "@/lib/constants";
import { formatCount } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import type { FixtureInfo } from "@/types/events";

const FAMILY_LABEL = new Map(FIXTURE_FAMILIES.map((entry) => [entry.family, entry.label]));

/**
 * Every test case the engine can replay for the corpus it is serving, grouped by
 * family and searchable by what is said. This is how a tester walks the eval set
 * by hand: a click replays the case through the same path the harness scores.
 */
export function FixtureBrowser() {
  const fixtures = useAppStore((state) => state.fixtures);
  const replayFixture = useAppStore((state) => state.replayFixture);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (fixture: FixtureInfo) =>
      !needle ||
      fixture.id.toLowerCase().includes(needle) ||
      fixture.turns.some((turn) => turn.toLowerCase().includes(needle));
    const order = [...FIXTURE_FAMILIES.map((entry) => entry.family)];
    for (const fixture of fixtures) if (!order.includes(fixture.family)) order.push(fixture.family);
    return order
      .map((family) => ({ family, items: fixtures.filter((f) => f.family === family && matches(f)) }))
      .filter((group) => group.items.length > 0);
  }, [fixtures, query]);

  if (fixtures.length === 0) return null;

  return (
    <details className="group/browser mx-auto mt-5 max-w-2xl text-left">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-center gap-1.5 text-caption text-ink-muted",
          "hover:text-primary-ink [&::-webkit-details-marker]:hidden",
        )}
      >
        Browse all {formatCount(fixtures.length)} test cases
        <ChevronDown size={14} aria-hidden className="transition-transform group-open/browser:rotate-180" />
      </summary>

      <div className="mt-3 rounded-md border border-line bg-raised shadow-card">
        <label className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search size={14} aria-hidden className="text-ink-muted" />
          <span className="sr-only">Filter test cases</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by id or by what is said…"
            className="w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
          />
        </label>

        <div className="max-h-80 overflow-y-auto">
          {groups.map((group) => (
            <section key={group.family} aria-label={FAMILY_LABEL.get(group.family) ?? group.family}>
              <h3 className="sticky top-0 bg-sunken px-3 py-1.5 text-caption font-semibold uppercase tracking-wide text-ink-muted">
                {FAMILY_LABEL.get(group.family) ?? group.family} · {group.items.length}
              </h3>
              <ul>
                {group.items.map((fixture) => (
                  <li key={fixture.id}>
                    <button
                      type="button"
                      onClick={() => replayFixture(fixture.id)}
                      title={fixture.description}
                      className={cn(
                        "group flex w-full items-start gap-2 px-3 py-2 text-left",
                        "transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none",
                      )}
                    >
                      <Play
                        size={12}
                        aria-hidden
                        className="mt-1 shrink-0 text-ink-muted group-hover:text-primary-ink"
                      />
                      <span className="min-w-0">
                        {fixture.turns.map((turn, index) => (
                          <span key={index} className={cn("block text-body text-ink", index > 0 && "text-ink-muted")}>
                            {index > 0 && "then: "}
                            {turn}
                          </span>
                        ))}
                        <span className="font-mono text-caption text-ink-muted">{fixture.id}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="px-3 py-4 text-caption text-ink-muted">No test case matches.</p>}
        </div>
      </div>
    </details>
  );
}
