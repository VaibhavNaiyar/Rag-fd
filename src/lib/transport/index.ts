import { createWebSocketTransport } from "@/lib/transport/socket";
import type { Transport, TransportHandlers } from "@/lib/transport/types";

export type { ConnectionStatus, Transport, TransportHandlers } from "@/lib/transport/types";

/**
 * Pick the transport for this build.
 *
 * The default is the real WebSocket. The simulator is opt-in through an env flag
 * and is dynamically imported, so it is code-split out of a production bundle
 * and can never be reached by an unflagged deployment.
 */
export function createTransport(handlers: TransportHandlers): Transport {
  if (process.env.NEXT_PUBLIC_TRANSPORT === "mock") {
    let inner: Transport | null = null;
    const pending: Parameters<Transport["send"]>[0][] = [];
    let closed = false;

    void import("@/lib/transport/mock").then(({ createMockTransport }) => {
      if (closed) return;
      inner = createMockTransport(handlers);
      inner.connect();
      for (const event of pending.splice(0)) inner.send(event);
    });

    return {
      kind: "mock",
      connect: () => {
        /* connect happens as soon as the module resolves */
      },
      close: () => {
        closed = true;
        inner?.close();
      },
      send: (event) => {
        if (inner) inner.send(event);
        else pending.push(event);
      },
    };
  }

  return createWebSocketTransport(handlers);
}
