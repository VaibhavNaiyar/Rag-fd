import { RECONNECT_BACKOFF_MS } from "@/lib/constants";
import type { Transport, TransportHandlers } from "@/lib/transport/types";
import { isServerEvent, type ClientEvent } from "@/types/events";

/** Derive the engine endpoint. Unset env means "same origin", which is what the
 *  single-container deployment relies on. */
function resolveUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}/stream`;
}

/**
 * WebSocket transport with capped exponential backoff.
 *
 * Frames that do not parse, or that parse to something without a `type`, are
 * dropped with a console warning rather than crashing the stream — a malformed
 * frame mid-demo should cost one event, not the session.
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
    const url = resolveUrl();
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
      if (!isServerEvent(parsed)) {
        console.warn("[transport] dropped frame without a type", parsed);
        return;
      }
      handlers.onEvent(parsed);
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
    kind: "websocket",
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
