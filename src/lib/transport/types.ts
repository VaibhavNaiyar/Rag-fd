import type { AGUIEvent } from "@ag-ui/core";
import type { ClientEvent } from "@/types/events";

export type ConnectionStatus = "connecting" | "open" | "closed";

/**
 * Everything the app knows about talking to the engine.
 *
 * The UI never references WebSocket directly: frames arrive here already
 * validated as AG-UI events, and input leaves as {@link ClientEvent}s.
 */
export interface Transport {
  connect: () => void;
  close: () => void;
  send: (event: ClientEvent) => void;
}

export interface TransportHandlers {
  onEvent: (event: AGUIEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
}
