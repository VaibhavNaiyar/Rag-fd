"use client";

import { Plug, PlugZap, Loader2 } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { useAppStore } from "@/store/useAppStore";

const STATUS: Record<string, { label: string; tone: PillTone; icon: typeof Plug }> = {
  connecting: { label: "Connecting", tone: "neutral", icon: Loader2 },
  open: { label: "Engine live", tone: "ok", icon: PlugZap },
  closed: { label: "Disconnected", tone: "error", icon: Plug },
};

/**
 * Connection state of the AG-UI stream to the engine.
 *
 * "Engine live" gets a pulsing dot alongside its icon+label — the glow is
 * purely decorative reinforcement of a state already spelled out in words,
 * never the only signal (§11: no state is colour-only).
 */
export function ConnectionBadge() {
  const connection = useAppStore((state) => state.connection);
  const status = STATUS[connection] ?? STATUS.closed;
  if (!status) return null;
  const Icon = status.icon;

  return (
    <Pill
      tone={status.tone}
      icon={
        connection === "open" ? (
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            {/* animate-ping (Tailwind's built-in, infinite by default) — not
                animate-pulse-ring, which this app defines for a one-shot marker
                appearance and stops after 2 cycles. A "live" dot needs to keep
                pulsing for as long as the connection stays open. */}
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--ok)] opacity-60" />
            <span className="relative h-2 w-2 rounded-full bg-[var(--ok)] shadow-[var(--glow-ok)]" />
          </span>
        ) : (
          <Icon size={12} aria-hidden className={connection === "connecting" ? "animate-spin" : undefined} />
        )
      }
    >
      {status.label}
    </Pill>
  );
}
