import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import type { Turn } from "@/store/types";
import { LegacyConsoleView, LegacyInspectorView, LegacyMetricsView, TracesPlaceholder } from "./LegacyBridge";

const EMPTY_TURN: Turn = {
  id: "t1",
  sessionId: "s1",
  transcript: [],
  utteranceEndMs: null,
  decisions: [],
  retrievals: [],
  firstRetrievalMs: null,
  subQueries: [],
  evidence: [],
  quotaApplied: false,
  fullCorpusSearch: true,
  versions: [],
  activeVersion: 1,
  latencyMs: null,
  cost: null,
  status: "listening",
  errorMessage: null,
};

beforeEach(() => {
  act(() => useAppStore.setState({ turns: [], phase: "idle", isListening: false, fixtures: [] }));
});

describe("the console view (the previous chat column)", () => {
  it("shows the composer, and is not a landmark: the frame's main is the only one", () => {
    const { container } = render(<LegacyConsoleView />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(container.querySelector("main")).toBeNull();
  });

  it("centres the idle greeting with auto margins in a column that scrolls, so its top can never be cut off", () => {
    const { container } = render(<LegacyConsoleView />);
    // The bridge's own column: the last child of its root (the replay bar, when shown, is the first).
    const column = container.firstElementChild?.lastElementChild as HTMLElement;
    expect(column).toHaveClass("overflow-y-auto");
    expect(column.className).not.toContain("justify-center");
    expect(column.firstElementChild).toHaveClass("my-auto");
  });

  it("docks the composer to the bottom once there is a conversation", () => {
    act(() => useAppStore.setState({ phase: "active" }));
    const { container } = render(<LegacyConsoleView />);
    const column = container.firstElementChild?.lastElementChild as HTMLElement;
    expect(column).not.toHaveClass("overflow-y-auto");
    expect(column).toHaveClass("justify-end");
    expect(column.firstElementChild).toHaveClass("flex-1", "justify-end");
  });

  it("shows the replay bar only in replay mode", () => {
    window.history.replaceState(null, "", "/?replay=1");
    const { unmount } = render(<LegacyConsoleView />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(1);
    unmount();
    window.history.replaceState(null, "", "/");
  });
});

describe("the Inspector view", () => {
  it("says there is no turn yet, without inventing one", () => {
    render(<LegacyInspectorView />);
    expect(screen.getByRole("heading", { name: "No turn yet" })).toBeInTheDocument();
  });

  it("names the newest turn and its state, and waits for its trace", () => {
    act(() => useAppStore.setState({ turns: [EMPTY_TURN] }));
    render(<LegacyInspectorView />);
    expect(screen.getByText("t1")).toHaveClass("font-mono");
    expect(screen.getByRole("heading", { name: "Waiting for the turn" })).toBeInTheDocument();
  });
});

describe("the traces and metrics views", () => {
  it("says the traces table is not built yet, and where the trace is meanwhile", () => {
    render(<TracesPlaceholder />);
    expect(screen.getByRole("heading", { name: "Traces", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/not built yet/)).toBeInTheDocument();
    expect(screen.getByText(/Inspector/)).toBeInTheDocument();
  });

  it("says there is nothing to summarise before the first turn", () => {
    render(<LegacyMetricsView />);
    expect(screen.getByText(/Nothing to summarise yet/)).toBeInTheDocument();
  });

  it("shows the previous session rollup once there is a turn", () => {
    act(() => useAppStore.setState({ turns: [{ ...EMPTY_TURN, status: "complete", latencyMs: { firstRetrieval: 100, firstToken: 800, complete: 2000 } }] }));
    render(<LegacyMetricsView />);
    expect(screen.getByRole("region", { name: "Session telemetry" })).toBeInTheDocument();
    expect(screen.getByText("Mean TTFT")).toBeInTheDocument();
  });
});
