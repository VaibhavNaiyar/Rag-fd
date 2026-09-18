import { EventType, type AGUIEvent } from "@ag-ui/core";

/**
 * Coalesces TEXT_MESSAGE_CONTENT events onto animation frames.
 *
 * A setState per token drops frames on a long answer and makes the engine look
 * slower than it is. Buffering here rather than inside a component keeps the
 * batching in one place and out of every message that renders a stream.
 *
 * Any other event flushes the buffer first, so a version's grounding record can
 * never be applied ahead of the text it describes.
 */
export interface TokenBatcher {
  push: (event: AGUIEvent) => void;
  dispose: () => void;
}

export function createTokenBatcher(dispatch: (event: AGUIEvent) => void): TokenBatcher {
  const pending = new Map<string, string>();
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    if (pending.size === 0) return;
    const batch = [...pending.entries()];
    pending.clear();
    for (const [messageId, delta] of batch) {
      dispatch({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta });
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
      if (event.type !== EventType.TEXT_MESSAGE_CONTENT) {
        flush();
        dispatch(event);
        return;
      }
      pending.set(event.messageId, (pending.get(event.messageId) ?? "") + event.delta);
      schedule();
    },
    dispose: () => {
      if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      frame = null;
      pending.clear();
    },
  };
}
