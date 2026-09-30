"use client";

import type { ConnectionStatus } from "@/lib/transport";
import { useAppStore } from "@/store/useAppStore";
import type { CorpusInfo } from "@/types/events";

export interface StatusFacts {
  connection: ConnectionStatus;
  /** The engine's session id, once the engine has said it. */
  sessionId: string | null;
  turns: number;
  /** How long the newest turn took, start to finish, in ms. `null` while it has not finished, or there is none. */
  lastTurnMs: number | null;
  corpus: CorpusInfo | null;
}

/**
 * The few facts the status strip and the phone menu both show, read from the store, so
 * they cannot disagree. Every field is a primitive selected on its own, so a component
 * that uses this re-renders only when one of them changes.
 */
export function useStatusFacts(): StatusFacts {
  const connection = useAppStore((state) => state.connection);
  const sessionId = useAppStore((state) => state.shared?.session?.id ?? null);
  const turns = useAppStore((state) => state.turns.length);
  const lastTurnMs = useAppStore((state) => state.turns[state.turns.length - 1]?.latencyMs?.complete ?? null);
  const corpus = useAppStore((state) => state.corpus);
  return { connection, sessionId, turns, lastTurnMs, corpus };
}
