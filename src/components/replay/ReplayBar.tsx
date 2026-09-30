"use client";

import { Gauge, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useHotkeys } from "@/hooks/useHotkeys";
import { cn } from "@/lib/cn";
import { REPLAY_SPEEDS } from "@/lib/constants";
import { featuredFixtures } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * Replay mode, revealed by `?replay=1`.
 *
 * The video is recorded once, under time pressure, so nothing in a take should
 * require typing. Number keys fire fixtures, R resets. The fixture payloads live
 * in `evals/fixtures/` server-side — the client only sends the name, which is
 * what keeps the no-hardcoding rule intact and means the console replays exactly
 * what the eval harness scores.
 */
export function ReplayBar() {
  const [speed, setSpeed] = useState<number>(1);
  const replayFixture = useAppStore((state) => state.replayFixture);
  const newSession = useAppStore((state) => state.newSession);
  const fixtures = useAppStore((state) => state.fixtures);
  const featured = featuredFixtures(fixtures);

  useHotkeys([
    ...featured.map((item) => ({
      key: item.hotkey,
      handler: () => replayFixture(item.fixture.id, speed),
    })),
    { key: "r", handler: newSession },
  ]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-warn-soft px-3 py-2">
      <span className="text-caption font-semibold uppercase tracking-wide text-warn-ink">
        Replay
      </span>

      {featured.map((item) => (
        <Button
          key={item.fixture.id}
          variant="outline"
          size="sm"
          onClick={() => replayFixture(item.fixture.id, speed)}
          title={`${item.proves}: ${item.fixture.turns.join(" / ")}`}
        >
          <kbd className="font-mono text-[10px] text-ink-muted">{item.hotkey}</kbd>
          {item.label}
        </Button>
      ))}

      <div className="ml-auto flex items-center gap-1.5">
        <Gauge size={14} aria-hidden className="text-warn-ink" />
        <label className="sr-only" htmlFor="replay-speed">
          Replay speed
        </label>
        <div id="replay-speed" role="group" aria-label="Replay speed" className="flex gap-0.5">
          {REPLAY_SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSpeed(option)}
              aria-pressed={speed === option}
              className={cn(
                "rounded-pill px-2 py-0.5 font-mono text-caption transition-colors",
                speed === option
                  ? "bg-primary text-[var(--on-primary)]"
                  : "text-warn-ink hover:bg-[var(--warn-hover)]",
              )}
            >
              {option}×
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={newSession} title="Reset the session (R)">
          <RotateCcw size={13} aria-hidden />
          Reset
        </Button>
      </div>
    </div>
  );
}
