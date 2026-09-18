import type { ClientEvent, ServerEvent } from "@/types/events";

export type ConnectionStatus = "connecting" | "open" | "closed";

/**
 * Everything the app knows about talking to the engine.
 *
 * The UI never references WebSocket directly. Keeping the surface this small is
 * what lets the in-browser simulator stand in for the backend without a single
 * component being aware of the swap.
 */
export interface Transport {
  connect: () => void;
  close: () => void;
  send: (event: ClientEvent) => void;
  /** Identifies the active implementation in the UI's connection badge. */
  readonly kind: "websocket" | "mock";
}

export interface TransportHandlers {
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
}
