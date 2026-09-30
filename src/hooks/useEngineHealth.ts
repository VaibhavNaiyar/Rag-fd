"use client";

import { useEffect, useState } from "react";
import { fetchHealth, type HealthResult } from "@/lib/health";

export interface UseEngineHealthOptions {
  /** Poll at all. Off in replay mode, so a recording is not disturbed. Default true. */
  enabled?: boolean;
  /** Milliseconds between checks. Default 30 000. */
  intervalMs?: number;
  /** For tests. */
  fetcher?: typeof fetchHealth;
}

/**
 * The engine's health, checked when the hook mounts and then every 30 seconds. Checks
 * stop while the tab is hidden and one runs the moment it is visible again, so a
 * background tab makes no requests. `refresh` checks now.
 */
export function useEngineHealth({ enabled = true, intervalMs = 30_000, fetcher = fetchHealth }: UseEngineHealthOptions = {}): { health: HealthResult; refresh: () => void } {
  const [health, setHealth] = useState<HealthResult>({ state: "checking" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let timer = 0;
    const controller = new AbortController();

    const schedule = () => {
      if (!stopped) timer = window.setTimeout(tick, intervalMs);
    };
    async function tick() {
      if (document.visibilityState === "hidden") {
        // Paused. The visibilitychange handler below resumes it.
        return;
      }
      const result = await fetcher({ signal: controller.signal });
      if (stopped) return;
      setHealth(result);
      schedule();
    }
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void tick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    void tick();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, fetcher, round]);

  return { health, refresh: () => setRound((current) => current + 1) };
}
