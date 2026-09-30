"use client";

import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { StatusDot, type StatusShape, type StatusTone } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import type { ConnectionStatus } from "@/lib/transport";
import { useAppStore } from "@/store/useAppStore";

export type ConnectionKind = "connecting" | "open" | "reconnecting" | "closed";

/** The five states of PHASES.md P4-F14 (the fifth, error, is the alert below): a mark whose shape says the state, and the words. */
const KINDS: Record<ConnectionKind, { label: string; shape: StatusShape; tone: StatusTone }> = {
  connecting: { label: "Connecting", shape: "ring", tone: "wait" },
  open: { label: "Engine live", shape: "filled", tone: "ok" },
  reconnecting: { label: "Reconnecting", shape: "ring", tone: "warn" },
  closed: { label: "Disconnected", shape: "barred", tone: "error" },
};

/**
 * What the stream is doing. The store keeps three values; this adds "reconnecting":
 * the stream is not open but has been (the engine has already told us about its corpus).
 */
export function connectionKind(connection: ConnectionStatus, hasBeenOpen: boolean): ConnectionKind {
  if (connection === "open") return "open";
  if (hasBeenOpen) return "reconnecting";
  return connection === "closed" ? "closed" : "connecting";
}

export interface ConnectionStateProps {
  /** "chrome" for the navy top bar, "default" for a surface. Default "default". */
  surface?: "chrome" | "default";
  /** Draw the mark alone below 480 px; the words stay for assistive technology. Default false. */
  collapse?: boolean;
  /** Announce changes. Turn it off on the second copy of the state on a page. Default true. */
  live?: boolean;
  className?: string;
}

/**
 * The connection to the engine, as a mark and words. It is a live region, so a change
 * (live, reconnecting, disconnected) is announced; and it never relies on colour alone:
 * the mark's shape and the words say it too.
 */
export function ConnectionState({ surface = "default", collapse = false, live = true, className }: ConnectionStateProps) {
  const connection = useAppStore((state) => state.connection);
  const hasBeenOpen = useAppStore((state) => state.corpus !== null);
  const kind = KINDS[connectionKind(connection, hasBeenOpen)];

  return (
    <div
      role={live ? "status" : undefined}
      data-connection-state={connectionKind(connection, hasBeenOpen)}
      className={cn("inline-flex min-w-0 items-center gap-2 text-caption", surface === "chrome" ? "text-on-chrome" : "text-ink-body", className)}
    >
      <StatusDot decorative shape={kind.shape} tone={kind.tone} />
      <span className={cn("min-w-0 truncate", collapse && "sr-only sm:not-sr-only")}>{kind.label}</span>
    </div>
  );
}

/**
 * The engine's error, in the flow of the page, with a way to try again. Nothing is shown
 * when there is no error; an unreachable engine is the state above, not an alert.
 */
export function ConnectionAlert({ className }: { className?: string }) {
  const lastError = useAppStore((state) => state.lastError);
  const dismissError = useAppStore((state) => state.dismissError);
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const connection = useAppStore((state) => state.connection);

  if (!lastError) return null;

  const retry = () => {
    disconnect();
    connect();
  };

  return (
    <InlineAlert
      tone="error"
      title={`The engine reported an error (${lastError.code})`}
      onDismiss={dismissError}
      action={
        connection === "open" ? undefined : (
          <Button size="sm" variant="secondary" onClick={retry}>
            Retry connection
          </Button>
        )
      }
      className={className}
    >
      {lastError.message}
    </InlineAlert>
  );
}
