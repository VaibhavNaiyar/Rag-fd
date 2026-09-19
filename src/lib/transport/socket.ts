import type { AGUIEvent } from "@ag-ui/core";
import { EventSchemas } from "@ag-ui/core/schemas";
import { RECONNECT_BACKOFF_MS } from "@/lib/constants";
import { streamUrl } from "@/lib/endpoints";
import type { Transport, TransportHandlers } from "@/lib/transport/types";
import type { ClientEvent } from "@/types/events";

/**
 * WebSocket transport with capped exponential backoff.
 *
 * Every frame is checked against AG-UI's own event schemas. One that does not
 * parse, or is not a valid AG-UI event, is dropped with a console warning
 * rather than crashing the stream — a malformed frame mid-session should cost one
 * event, not the session.
 */
export function createWebSocketTransport(handlers: TransportHandlers): Transport {
  let socket: WebSocket | null = null;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const queue: ClientEvent[] = [];

  const flush = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) socket.send(JSON.stringify(next));
    }
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    const index = Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1);
    const delay = RECONNECT_BACKOFF_MS[index] ?? 8000;
    attempt += 1;
    retryTimer = setTimeout(open, delay);
  };

  function open() {
    if (disposed) return;
    const url = streamUrl();
    if (!url) return;

    handlers.onStatus("connecting");
    try {
      socket = new WebSocket(url);
    } catch {
      handlers.onStatus("closed");
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      attempt = 0;
      handlers.onStatus("open");
      flush();
    };

    socket.onmessage = (message) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message.data));
      } catch {
        console.warn("[transport] dropped unparseable frame");
        return;
      }
      const event = EventSchemas.safeParse(parsed);
      if (!event.success) {
        console.warn("[transport] dropped a frame that is not an AG-UI event", parsed);
        return;
      }
      handlers.onEvent(event.data as AGUIEvent);
    };

    socket.onerror = () => {
      // `onclose` always follows; reconnect is handled there so it runs once.
    };

    socket.onclose = () => {
      socket = null;
      handlers.onStatus("closed");
      scheduleReconnect();
    };
  }

  return {
    connect: open,
    send: (event) => {
      queue.push(event);
      flush();
    },
    close: () => {
      disposed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      socket?.close();
      socket = null;
      handlers.onStatus("closed");
    },
  };
}
