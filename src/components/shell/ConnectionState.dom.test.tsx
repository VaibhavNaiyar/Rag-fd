import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionAlert, ConnectionState, connectionKind } from "./ConnectionState";

const CORPUS = { docs: 12, chunks: 96 };

beforeEach(() => {
  act(() => useAppStore.setState({ connection: "connecting", corpus: null, lastError: null }));
});

describe("connectionKind", () => {
  it.each([
    ["open", false, "open"],
    ["open", true, "open"],
    ["connecting", false, "connecting"],
    ["closed", false, "closed"],
    ["closed", true, "reconnecting"],
    ["connecting", true, "reconnecting"],
  ] as const)("%s, seen open before: %s, is %s", (connection, hasBeenOpen, expected) => {
    expect(connectionKind(connection, hasBeenOpen)).toBe(expected);
  });
});

describe("ConnectionState", () => {
  it.each([
    [{ connection: "connecting", corpus: null }, "Connecting", "ring"],
    [{ connection: "open", corpus: CORPUS }, "Engine live", "filled"],
    [{ connection: "closed", corpus: CORPUS }, "Reconnecting", "ring"],
    [{ connection: "closed", corpus: null }, "Disconnected", "barred"],
  ] as const)("says %j as %s, with a %s mark", (state, words, shape) => {
    act(() => useAppStore.setState({ ...state }));
    const { container } = render(<ConnectionState />);
    expect(screen.getByText(words)).toBeInTheDocument();
    expect(container.querySelector(`[data-shape="${shape}"]`)).not.toBeNull();
  });

  it("gives each state a different mark or a different tone, so the state is not colour alone", () => {
    const seen = new Set<string>();
    for (const [connection, corpus] of [["connecting", null], ["open", CORPUS], ["closed", CORPUS], ["closed", null]] as const) {
      act(() => useAppStore.setState({ connection, corpus }));
      const { container, unmount } = render(<ConnectionState />);
      const dot = container.querySelector("[data-shape]");
      seen.add(`${dot?.getAttribute("data-shape")}|${dot?.innerHTML}`);
      unmount();
    }
    expect(seen.size).toBe(4);
  });

  it("is a live region, so a change is announced", () => {
    render(<ConnectionState />);
    expect(screen.getByRole("status")).toHaveTextContent("Connecting");
    act(() => useAppStore.setState({ connection: "open", corpus: CORPUS }));
    expect(screen.getByRole("status")).toHaveTextContent("Engine live");
  });

  it("is not a live region when it is the second copy on the page", () => {
    render(<ConnectionState live={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("can collapse to the mark alone below 480 px, keeping the words for assistive technology", () => {
    render(<ConnectionState collapse />);
    expect(screen.getByText("Connecting")).toHaveClass("sr-only", "sm:not-sr-only");
  });

  it("takes its colours from the surface it is on", () => {
    const { rerender } = render(<ConnectionState surface="chrome" />);
    expect(screen.getByRole("status")).toHaveClass("text-on-chrome");
    rerender(<ConnectionState surface="default" />);
    expect(screen.getByRole("status")).toHaveClass("text-ink-body");
  });

  it("truncates rather than widen its row, and does not pulse", () => {
    const { container } = render(<ConnectionState />);
    expect(screen.getByText("Connecting")).toHaveClass("truncate", "min-w-0");
    expect(container.innerHTML).not.toMatch(/animate-|shadow-|glow/);
  });
});

describe("ConnectionAlert", () => {
  it("shows nothing when there is no error", () => {
    const { container } = render(<ConnectionAlert />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the engine's error with its code, as an alert", () => {
    act(() => useAppStore.setState({ lastError: { code: "bad_request", message: "unknown fixture nope" } }));
    render(<ConnectionAlert />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("bad_request");
    expect(alert).toHaveTextContent("unknown fixture nope");
  });

  it("wraps a long unbroken message instead of widening the page", () => {
    act(() => useAppStore.setState({ lastError: { code: "x", message: "https://engine.example/".repeat(30) } }));
    render(<ConnectionAlert />);
    expect(screen.getByRole("alert").querySelector(".break-words")).not.toBeNull();
  });

  it("can be dismissed, which clears the error", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.setState({ lastError: { code: "x", message: "boom" } }));
    render(<ConnectionAlert />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(useAppStore.getState().lastError).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a retry when the stream is not open, which closes and opens it again", async () => {
    const user = userEvent.setup();
    const connect = vi.fn();
    const disconnect = vi.fn();
    act(() => useAppStore.setState({ connection: "closed", lastError: { code: "socket", message: "closed" }, connect, disconnect }));
    render(<ConnectionAlert />);
    await user.click(screen.getByRole("button", { name: "Retry connection" }));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect.mock.invocationCallOrder[0]).toBeLessThan(connect.mock.invocationCallOrder[0] ?? 0);
  });

  it("offers no retry while the stream is open: the error is about a turn, not the connection", () => {
    act(() => useAppStore.setState({ connection: "open", lastError: { code: "bad_request", message: "nope" } }));
    render(<ConnectionAlert />);
    expect(screen.queryByRole("button", { name: "Retry connection" })).toBeNull();
  });
});
