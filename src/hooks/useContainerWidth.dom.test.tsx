import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContainerWidth } from "./useContainerWidth";
import { useElementWidth } from "./useElementWidth";

/**
 * A ResizeObserver that fires on demand, and a requestAnimationFrame that runs on
 * demand, so "once per frame" can be counted exactly.
 */
class ManualObserver {
  static all: ManualObserver[] = [];
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    ManualObserver.all.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire(width: number) {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

let frames: (FrameRequestCallback | null)[] = [];
const runFrame = () => {
  const pending = frames;
  frames = [];
  act(() => pending.forEach((callback) => callback?.(0)));
};

beforeEach(() => {
  ManualObserver.all = [];
  frames = [];
  vi.stubGlobal("ResizeObserver", ManualObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ fallback, onRender }: { fallback?: number; onRender?: () => void }) {
  const { ref, width, size } = useContainerWidth<HTMLDivElement>({ fallback });
  onRender?.();
  return (
    <div ref={ref}>
      {width} {size}
    </div>
  );
}

describe("useContainerWidth", () => {
  it("is the fallback until it has been measured, then the measured width and its class", () => {
    render(<Probe fallback={320} />);
    expect(screen.getByText("320 xs")).toBeInTheDocument();
    act(() => ManualObserver.all[0]?.fire(1024));
    runFrame();
    expect(screen.getByText("1024 lg")).toBeInTheDocument();
  });

  it("classifies the widths the way the breakpoints do", () => {
    render(<Probe />);
    const observer = ManualObserver.all[0];
    for (const [width, size] of [[300, "xs"], [479, "xs"], [480, "sm"], [768, "md"], [1024, "lg"]] as const) {
      act(() => observer?.fire(width));
      runFrame();
      expect(screen.getByText(`${width} ${size}`)).toBeInTheDocument();
    }
  });

  it("updates once per frame while a pane is dragged, however many times the observer fires (the acceptance test)", () => {
    let renders = 0;
    render(<Probe onRender={() => (renders += 1)} />);
    const before = renders;
    const observer = ManualObserver.all[0];

    // Forty observer callbacks inside one frame: the pane being dragged.
    for (let width = 400; width < 440; width += 1) observer?.fire(width);
    expect(frames.filter(Boolean)).toHaveLength(1);
    expect(renders).toBe(before);

    runFrame();
    expect(renders).toBe(before + 1);
    expect(screen.getByText("439 xs")).toBeInTheDocument();

    // A second frame of movement is a second update, and no more.
    for (let width = 440; width < 500; width += 1) observer?.fire(width);
    runFrame();
    expect(renders).toBe(before + 2);
    expect(screen.getByText("499 sm")).toBeInTheDocument();
  });

  it("does not render again when the width has not changed", () => {
    let renders = 0;
    render(<Probe fallback={320} onRender={() => (renders += 1)} />);
    act(() => ManualObserver.all[0]?.fire(320));
    runFrame();
    const settled = renders;
    act(() => ManualObserver.all[0]?.fire(320));
    runFrame();
    expect(renders).toBe(settled);
  });

  it("rounds to whole pixels and never reports less than one", () => {
    render(<Probe />);
    act(() => ManualObserver.all[0]?.fire(600.6));
    runFrame();
    expect(screen.getByText("601 sm")).toBeInTheDocument();
    act(() => ManualObserver.all[0]?.fire(0));
    runFrame();
    expect(screen.getByText("1 xs")).toBeInTheDocument();
  });

  it("disconnects and cancels its pending frame when it unmounts", () => {
    const { unmount } = render(<Probe />);
    ManualObserver.all[0]?.fire(500);
    unmount();
    expect(ManualObserver.all[0]?.disconnected).toBe(true);
    expect(frames.filter(Boolean)).toHaveLength(0);
  });

  it("works without ResizeObserver, staying at the fallback", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<Probe fallback={500} />);
    expect(screen.getByText("500 sm")).toBeInTheDocument();
  });
});

describe("useElementWidth (the previous name)", () => {
  it("is the same hook with its previous shape", () => {
    function Legacy() {
      const { ref, width } = useElementWidth<HTMLDivElement>(280);
      return <div ref={ref}>{width}</div>;
    }
    render(<Legacy />);
    expect(screen.getByText("280")).toBeInTheDocument();
    act(() => ManualObserver.all[0]?.fire(360));
    runFrame();
    expect(screen.getByText("360")).toBeInTheDocument();
  });
});
