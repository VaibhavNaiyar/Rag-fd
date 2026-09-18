"use client";

import { FlaskConical, Plug, PlugZap, Loader2 } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { useAppStore } from "@/store/useAppStore";

const STATUS: Record<string, { label: string; tone: PillTone; icon: typeof Plug }> = {
  connecting: { label: "Connecting", tone: "neutral", icon: Loader2 },
  open: { label: "Engine live", tone: "ok", icon: PlugZap },
  closed: { label: "Disconnected", tone: "error", icon: Plug },
};

/**
 * Connection state, and — loudly — whether the simulator is standing in for the
 * engine. Nobody should ever mistake a simulated trace for a real one.
 */
export function ConnectionBadge() {
  const connection = useAppStore((state) => state.connection);
  const transportKind = useAppStore((state) => state.transportKind);

  if (transportKind === "mock") {
    return (
      <Pill tone="warn" icon={<FlaskConical size={12} aria-hidden />}>
        Simulated engine
      </Pill>
    );
  }

  const status = STATUS[connection] ?? STATUS.closed;
  if (!status) return null;
  const Icon = status.icon;

  return (
    <Pill tone={status.tone} icon={<Icon size={12} aria-hidden className={connection === "connecting" ? "animate-spin" : undefined} />}>
      {status.label}
    </Pill>
  );
}
