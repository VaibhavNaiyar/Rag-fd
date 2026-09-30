import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthResult } from "@/lib/health";
import { useEngineHealth, type UseEngineHealthOptions } from "./useEngineHealth";

const OK: HealthResult = { state: "ok", at: 1, health: { version: "0.3.0", corpus: { docs: 12, chunks: 96 }, models: {} } };

function Probe(options: UseEngineHealthOptions & { onRefresh?: (refresh: () => void) => void }) {
  const { health, refresh } = useEngineHealth(options);
  options.onRefresh?.(refresh);
  return <p>{health.state}</p>;
}

function visibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => void document.dispatchEvent(new Event("visibilitychange")));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility("visible");
});

afterEach(() => {
  Reflect.deleteProperty(document, "visibilityState");
});

const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));

describe("useEngineHealth", () => {
  it("checks when it mounts, and shows the answer", async () => {
    const fetcher = vi.fn().mockResolvedValue(OK);
    render(<Probe fetcher={fetcher} />);
    expect(screen.getByText("checking")).toBeInTheDocument();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("checks again every 30 seconds, and not before", async () => {
    const fetcher = vi.fn().mockResolvedValue(OK);
    render(<Probe fetcher={fetcher} />);
    await settle();
    await act(async () => void (await vi.advanceTimersByTimeAsync(29_999)));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => void (await vi.advanceTimersByTimeAsync(2)));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => void (await vi.advanceTimersByTimeAsync(30_000)));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("stops while the tab is hidden, and checks at once when it is visible again (the acceptance test)", async () => {
    const fetcher = vi.fn().mockResolvedValue(OK);
    render(<Probe fetcher={fetcher} />);
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);

    visibility("hidden");
    await act(async () => void (await vi.advanceTimersByTimeAsync(31_000)));
    // The timer fired, saw the hidden tab, and did not ask.
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => void (await vi.advanceTimersByTimeAsync(120_000)));
    expect(fetcher).toHaveBeenCalledTimes(1);

    visibility("visible");
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not check at all when it is not enabled (replay mode)", async () => {
    const fetcher = vi.fn().mockResolvedValue(OK);
    render(<Probe fetcher={fetcher} enabled={false} />);
    await act(async () => void (await vi.advanceTimersByTimeAsync(120_000)));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByText("checking")).toBeInTheDocument();
  });

  it("starts checking when it becomes enabled, and stops when it does not", async () => {
    const fetcher = vi.fn().mockResolvedValue(OK);
    const { rerender } = render(<Probe fetcher={fetcher} enabled={false} />);
    rerender(<Probe fetcher={fetcher} enabled />);
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender(<Probe fetcher={fetcher} enabled={false} />);
    await act(async () => void (await vi.advanceTimersByTimeAsync(90_000)));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("checks now when asked", async () => {
    const fetcher = vi.fn().mockResolvedValue(OK);
    let refresh: () => void = () => undefined;
    render(<Probe fetcher={fetcher} onRefresh={(next) => (refresh = next)} />);
    await settle();
    act(() => refresh());
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("stops and cancels its request when it unmounts", async () => {
    let seen: AbortSignal | undefined;
    const fetcher = vi.fn().mockImplementation(({ signal }: { signal?: AbortSignal }) => {
      seen = signal;
      return new Promise(() => undefined);
    });
    const { unmount } = render(<Probe fetcher={fetcher} />);
    await settle();
    unmount();
    expect(seen?.aborted).toBe(true);
    await act(async () => void (await vi.advanceTimersByTimeAsync(120_000)));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shows an unreachable engine as unknown, and keeps checking", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ state: "unknown" }).mockResolvedValue(OK);
    render(<Probe fetcher={fetcher} />);
    await settle();
    expect(screen.getByText("unknown")).toBeInTheDocument();
    await act(async () => void (await vi.advanceTimersByTimeAsync(30_001)));
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("ignores an answer that arrives after it has unmounted", async () => {
    let resolve: (value: HealthResult) => void = () => undefined;
    const fetcher = vi.fn().mockImplementation(() => new Promise<HealthResult>((done) => (resolve = done)));
    const { unmount } = render(<Probe fetcher={fetcher} />);
    await settle();
    unmount();
    await act(async () => resolve(OK));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
