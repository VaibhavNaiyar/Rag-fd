import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useThrottledValue } from "@/hooks/useThrottledValue";

describe("useThrottledValue", () => {
  it("applies the first value immediately (leading edge)", () => {
    const { result } = renderHook(() => useThrottledValue("a", 100));
    expect(result.current).toBe("a");
  });

  it("coalesces rapid changes inside a window into one trailing update", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useThrottledValue(value, 100), { initialProps: { value: "v0" } });
    expect(result.current).toBe("v0");

    // Twenty rapid updates inside one 100ms window — as fast as a token batcher's rAF pushes could arrive.
    for (let i = 1; i <= 20; i += 1) {
      act(() => {
        rerender({ value: `v${i}` });
        vi.advanceTimersByTime(4);
      });
    }
    // Still the leading value — the window has not elapsed yet.
    expect(result.current).toBe("v0");

    act(() => vi.advanceTimersByTime(100));
    // The trailing update carries the LAST value, not a dropped intermediate one.
    expect(result.current).toBe("v20");
    vi.useRealTimers();
  });

  it("never drops the final value even if updates stop mid-window", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useThrottledValue(value, 100), { initialProps: { value: "start" } });
    act(() => {
      rerender({ value: "start" }); // establish the leading edge at t=0
    });
    act(() => vi.advanceTimersByTime(10));
    act(() => rerender({ value: "final" }));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("final");
    vi.useRealTimers();
  });

  it("re-parses at most 8 times per second under continuous 60fps updates (the PB-03 bound)", () => {
    vi.useFakeTimers();
    const onRender = vi.fn();
    const { rerender } = renderHook(({ value }) => {
      const throttled = useThrottledValue(value, 125); // 1000ms / 8
      onRender(throttled);
      return throttled;
    }, { initialProps: { value: 0 } });

    // Simulate 3 seconds of 60fps updates.
    for (let frame = 1; frame <= 180; frame += 1) {
      act(() => {
        rerender({ value: frame });
        vi.advanceTimersByTime(1000 / 60);
      });
    }
    act(() => vi.advanceTimersByTime(200)); // flush the final trailing update

    const distinctValues = new Set(onRender.mock.calls.map((call) => call[0]));
    // 3 seconds at <= 8/sec is at most ~25 distinct emitted values (leading + trailing per window, plus the final flush).
    expect(distinctValues.size).toBeLessThanOrEqual(28);
    vi.useRealTimers();
  });
});
