"use client";

import { Gauge, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { Segmented } from "@/components/ui/Segmented";
import { useHotkeys } from "@/hooks/useHotkeys";
import { REPLAY_SPEEDS } from "@/lib/constants";
import { featuredFixtures } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * Replay mode (P6-F14, replaces `ReplayBar`), revealed by `?replay=1`. Nothing
 * in a recorded take should require typing: number keys 1–4 fire the featured
 * fixtures, `R` resets. The fixture payloads live server-side — the client only
 * sends the name, which is what keeps the console replaying exactly what the
 * eval harness scores.
 */
export function ReplayControls() {
  const [speed, setSpeed] = useState("1");
  const replayFixture = useAppStore((state) => state.replayFixture);
  const newSession = useAppStore((state) => state.newSession);
  const fixtures = useAppStore((state) => state.fixtures);
  const featured = featuredFixtures(fixtures);

  useHotkeys([
    ...featured.map((item) => ({ key: item.hotkey, handler: () => replayFixture(item.fixture.id, Number(speed)) })),
    { key: "r", handler: newSession },
  ]);

  return (
    <div className="flex min-h-hit flex-wrap items-center gap-2 border-b border-warn-edge bg-warn-soft px-3 py-2">
      <span className="text-caption font-semibold uppercase tracking-wide text-warn-ink">Replay</span>

      {featured.map((item) => (
        <Button key={item.fixture.id} variant="secondary" size="sm" onClick={() => replayFixture(item.fixture.id, Number(speed))} title={`${item.proves}: ${item.fixture.turns.join(" / ")}`}>
          <Kbd keys={[item.hotkey]} />
          {item.label}
        </Button>
      ))}

      <div className="ml-auto flex items-center gap-1.5">
        <Gauge size={14} aria-hidden className="text-warn-ink" />
        <Segmented
          label="Replay speed"
          size="sm"
          value={speed}
          onValueChange={setSpeed}
          options={REPLAY_SPEEDS.map((value) => ({ value: String(value), label: `${value}×` }))}
        />
        <Button variant="secondary" size="sm" onClick={newSession} title="Reset the session">
          <RotateCcw size={13} aria-hidden />
          Reset
          <Kbd keys={["r"]} />
        </Button>
      </div>
    </div>
  );
}
