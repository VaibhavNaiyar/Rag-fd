import type { ServerEvent } from "@/types/events";

/**
 * Coalesces `answer.token` events onto animation frames.
 *
 * A setState per token drops frames on a long answer and makes the engine look
 * slower than it is. Buffering here rather than inside a component keeps the
 * batching in one place and out of every message that renders a stream.
 *
 * Any non-token event flushes the buffer first, so a version summary can never
 * be applied ahead of the tokens it describes.
 */
export interface TokenBatcher {
  push: (event: ServerEvent) => void;
  dispose: () => void;
}

interface Pending {
  turnId: string;
  version: number;
  text: string;
}

export function createTokenBatcher(dispatch: (event: ServerEvent) => void): TokenBatcher {
  const pending = new Map<string, Pending>();
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    if (pending.size === 0) return;
    const batch = [...pending.values()];
    pending.clear();
    for (const item of batch) {
      dispatch({ type: "answer.token", turnId: item.turnId, version: item.version, text: item.text });
    }
  };

  const schedule = () => {
    if (frame !== null) return;
    frame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(flush)
        : (setTimeout(flush, 16) as unknown as number);
  };

  return {
    push: (event) => {
      if (event.type !== "answer.token") {
        flush();
        dispatch(event);
        return;
      }
      const key = `${event.turnId}::${event.version}`;
      const existing = pending.get(key);
      if (existing) existing.text += event.text;
      else pending.set(key, { turnId: event.turnId, version: event.version, text: event.text });
      schedule();
    },
    dispose: () => {
      if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      frame = null;
      pending.clear();
    },
  };
}
