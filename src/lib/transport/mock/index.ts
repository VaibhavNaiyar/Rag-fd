import { MOCK_CORPUS, resetHitCounter } from "@/lib/transport/mock/corpus";
import { MOCK_SCENARIOS, scenarioForTypedText } from "@/lib/transport/mock/scenarios";
import { buildTurnScript, type ScriptStep } from "@/lib/transport/mock/script";
import type { Transport, TransportHandlers } from "@/lib/transport/types";

/**
 * SIMULATOR ONLY — active when NEXT_PUBLIC_TRANSPORT=mock.
 *
 * Replays a compiled event script at wall-clock pace so the console can be built
 * and demonstrated before the engine exists. It implements the same `Transport`
 * interface as the real socket, so no component knows which one is running.
 */
export function createMockTransport(handlers: TransportHandlers): Transport {
  let turnCounter = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let typedBuffer = "";
  let speed = 1;

  const clearTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };

  const play = (steps: ScriptStep[]) => {
    clearTimers();
    for (const step of steps) {
      timers.push(
        setTimeout(() => {
          handlers.onEvent(step.event);
        }, step.atMs / speed),
      );
    }
  };

  const startTurn = (spec: Parameters<typeof buildTurnScript>[1]) => {
    turnCounter += 1;
    play(buildTurnScript(`turn_${turnCounter}`, spec));
  };

  const announceSession = () => {
    resetHitCounter();
    handlers.onStatus("open");
    handlers.onEvent({
      type: "session.ready",
      sessionId: `mock_${Date.now().toString(36)}`,
      corpus: { ...MOCK_CORPUS, indexedAt: Date.now() - 12_000 },
    });
  };

  return {
    kind: "mock",
    connect: () => {
      handlers.onStatus("connecting");
      timers.push(setTimeout(announceSession, 260));
    },
    close: () => {
      clearTimers();
      handlers.onStatus("closed");
    },
    send: (event) => {
      switch (event.type) {
        case "utterance.start":
          typedBuffer = "";
          return;
        case "utterance.chunk":
          // The simulator reassembles what the engine would consume incrementally.
          typedBuffer = typedBuffer ? `${typedBuffer} ${event.text}` : event.text;
          return;
        case "utterance.end":
          if (typedBuffer.trim()) startTurn(scenarioForTypedText(typedBuffer.trim()));
          typedBuffer = "";
          return;
        case "replay": {
          speed = event.speed ?? 1;
          const scenario = MOCK_SCENARIOS[event.fixture];
          if (!scenario) {
            handlers.onEvent({
              type: "error",
              code: "unknown_fixture",
              message: `No fixture named "${event.fixture}" is registered.`,
            });
            return;
          }
          startTurn(scenario);
          return;
        }
        case "session.new":
          clearTimers();
          announceSession();
          return;
      }
    },
  };
}
