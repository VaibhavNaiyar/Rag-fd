"use client";

import { ArrowUpRight } from "lucide-react";
import { FixtureBrowser } from "@/components/chat/FixtureBrowser";
import { cn } from "@/lib/cn";
import { featuredFixtures } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * The IDLE state.
 *
 * One line, then the suggestion chips. The chips are the same four fixtures the
 * replay bar fires, so an unscripted judge clicking around still lands on the
 * behaviours that matter. Corpus size lives in the sidebar footer.
 */
export function Greeting() {
  const replayFixture = useAppStore((state) => state.replayFixture);
  const featured = featuredFixtures(useAppStore((state) => state.fixtures));

  return (
    <div className="animate-message-in pb-8 text-center">
      <h1 className="text-display text-ink">Ask me anything about the corpus.</h1>

      <ul className="mx-auto mt-7 grid max-w-2xl gap-2 sm:grid-cols-2">
        {featured.map(({ fixture, label, proves }) => (
          <li key={fixture.id}>
            <button
              type="button"
              onClick={() => replayFixture(fixture.id)}
              title={fixture.turns.join(" / ")}
              className={cn(
                "group flex h-full w-full flex-col items-start gap-1 rounded-md border border-line",
                "bg-raised px-3.5 py-3 text-left shadow-card",
                "transition-[border-color,box-shadow,transform] duration-150 ease-oneui",
                "hover:-translate-y-px hover:border-primary hover:shadow-lift",
              )}
            >
              <span className="flex w-full items-center gap-2">
                <span className="text-label text-ink">{label}</span>
                <ArrowUpRight
                  size={14}
                  aria-hidden
                  className="ml-auto shrink-0 text-ink-muted transition-colors group-hover:text-primary-ink"
                />
              </span>
              <span className="line-clamp-2 text-caption text-ink">“{fixture.turns[0]}”</span>
              <span className="text-caption text-ink-muted">{proves}</span>
            </button>
          </li>
        ))}
      </ul>

      <FixtureBrowser />
    </div>
  );
}
