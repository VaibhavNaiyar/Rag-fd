"use client";

import { useRef } from "react";
import { TurnRecord } from "@/components/console/TurnRecord";
import { useHotkeys } from "@/hooks/useHotkeys";
import { selectSessionTurns } from "@/store/selectors";
import { useAppStore } from "@/store/useAppStore";

/**
 * The conversation, as an ARIA feed (P6-F02): each turn is an `article`,
 * directly inside the `feed` — axe's `aria-required-children`/`listitem`
 * rules reject a `<li>` wrapper once the container's role is `feed` rather
 * than `list`, so `TurnRecord` renders its own root and this only adds the
 * feed-position attributes.
 *
 * `j`/`k` move the selection, which also opens the turn in the Inspector, and
 * move DOM focus to the newly selected article — but only from here, in
 * response to the keypress itself, never from a `selectedTurn` subscription:
 * the Inspector (`Workbench.tsx`) moves focus into itself when it opens on a
 * selection made elsewhere (a click on "Open inspector"), and a ledger effect
 * reacting to the same state change would race it for focus.
 */
export function TurnLedger() {
  const turns = useAppStore(selectSessionTurns);
  const selectedTurn = useAppStore((state) => state.selectedTurn);
  const selectTurn = useAppStore((state) => state.selectTurn);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  const selectedIndex = selectedTurn ? turns.findIndex((turn) => turn.sessionId === selectedTurn.sessionId && turn.id === selectedTurn.turnId) : -1;

  const move = (delta: number) => {
    if (turns.length === 0) return;
    const from = selectedIndex === -1 ? turns.length - 1 : selectedIndex;
    const next = Math.min(turns.length - 1, Math.max(0, from + delta));
    const turn = turns[next];
    if (!turn) return;
    selectTurn({ sessionId: turn.sessionId, turnId: turn.id });
    itemRefs.current.get(`${turn.sessionId}:${turn.id}`)?.focus();
  };

  useHotkeys([
    { key: "j", handler: () => move(1) },
    { key: "k", handler: () => move(-1) },
  ]);

  const busy = turns.some((turn) => turn.status !== "complete" && turn.status !== "error");

  return (
    <div role="feed" aria-label="Turns" aria-busy={busy} className="space-y-6">
      {turns.map((turn, index) => {
        const key = `${turn.sessionId}:${turn.id}`;
        const current = selectedTurn?.sessionId === turn.sessionId && selectedTurn.turnId === turn.id;
        return (
          <TurnRecord
            key={key}
            ref={(node) => {
              if (node) itemRefs.current.set(key, node);
              else itemRefs.current.delete(key);
            }}
            turn={turn}
            tabIndex={-1}
            aria-posinset={index + 1}
            aria-setsize={turns.length}
            {...(current ? { "aria-current": "true" as const } : {})}
          />
        );
      })}
    </div>
  );
}
