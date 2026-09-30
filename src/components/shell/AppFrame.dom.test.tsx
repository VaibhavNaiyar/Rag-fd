import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetActiveView } from "@/hooks/useActiveView";
import type { Turn } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { setMedia } from "@/test/setup";
import { AppFrame } from "./AppFrame";

const MIN = (px: number) => `(min-width: ${px}px)`;
const PHONE = {};
const TABLET = { [MIN(480)]: true, [MIN(768)]: true };
const DESKTOP = { ...TABLET, [MIN(1024)]: true };

function makeTurn(id: string): Turn {
  return {
    id,
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
}

let connect = vi.fn();
let disconnect = vi.fn();
let newSession = vi.fn();
let stopStreaming = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  window.location.hash = "";
  window.localStorage.clear();
  resetActiveView();
  connect = vi.fn();
  disconnect = vi.fn();
  newSession = vi.fn();
  stopStreaming = vi.fn();
  act(() =>
    useAppStore.setState({
      connection: "open",
      corpus: { docs: 12, chunks: 96 },
      shared: { session: { id: "s_mock_0001", corpus: { docs: 12, chunks: 96 } }, turns: {} },
      turns: [],
      phase: "idle",
      lastError: null,
      connect,
      disconnect,
      newSession,
      stopStreaming,
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("AppFrame: landmarks", () => {
  it("has one main, a banner, a footer and the views navigation; the Inspector is not among them until it is opened", () => {
    render(<AppFrame />);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.queryByRole("complementary")).toBeNull();
    // The nav rail and the tab bar are both in the page; CSS shows one of them (kit and shell specs check that in a browser).
    expect(screen.getAllByRole("navigation", { name: "Views" })).toHaveLength(2);
  });

  it("makes the skip link the first tab stop, and it moves focus to the main content (the acceptance test)", async () => {
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe("");
  });

  it("renders the root every floating layer goes into, outside the frame, so a modal can make the frame inert", () => {
    const { container } = render(<AppFrame />);
    const root = document.getElementById("layer-root");
    expect(root).not.toBeNull();
    expect(container.querySelector(".frame")?.contains(root)).toBe(false);
  });

  it("shows the connection in a data attribute, for tests to wait on", () => {
    const { container } = render(<AppFrame />);
    expect(container.querySelector(".frame")).toHaveAttribute("data-connection", "open");
    act(() => useAppStore.setState({ connection: "closed" }));
    expect(container.querySelector(".frame")).toHaveAttribute("data-connection", "closed");
  });
});

describe("AppFrame: the connection", () => {
  it("opens the stream when it mounts and closes it when it goes", () => {
    const { unmount } = render(<AppFrame />);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows an engine error in the flow of the view, with a way to dismiss it", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.setState({ lastError: { code: "bad_request", message: "unknown fixture" } }));
    render(<AppFrame />);
    const main = screen.getByRole("main");
    expect(within(main).getByRole("alert")).toHaveTextContent("unknown fixture");
    await user.click(within(main).getByRole("button", { name: "Dismiss" }));
    expect(within(main).queryByRole("alert")).toBeNull();
  });
});

describe("AppFrame: views", () => {
  it("shows the console for no hash, and marks it current in both navigations", () => {
    render(<AppFrame />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /^Console$/ })) expect(link).toHaveAttribute("aria-current", "page");
  });

  it("follows the address: #/metrics shows the metrics view and marks it current", async () => {
    render(<AppFrame />);
    act(() => void (window.location.hash = "#/metrics"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Metrics", level: 2 })).toBeInTheDocument());
    for (const link of screen.getAllByRole("link", { name: /^Metrics$/ })) expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("follows a link in the tab bar", async () => {
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.click(within(screen.getAllByRole("navigation", { name: "Views" })[1] as HTMLElement).getByRole("link", { name: "Traces" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Traces", level: 2 })).toBeInTheDocument());
  });

  it("goes back with the browser's Back", async () => {
    render(<AppFrame />);
    act(() => void (window.location.hash = "#/traces"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Traces", level: 2 })).toBeInTheDocument());
    act(() => void (window.location.hash = "#/metrics"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Metrics", level: 2 })).toBeInTheDocument());
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Traces", level: 2 })).toBeInTheDocument());
  });

  it("does not poll the engine's health in replay mode", () => {
    window.history.replaceState(null, "", "/?replay=1");
    render(<AppFrame />);
    expect(fetch).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });

  it("asks the engine for its health when it is not replay mode", async () => {
    render(<AppFrame />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toMatch(/\/health$/);
  });
});

describe("AppFrame: the Inspector", () => {
  it("opens as a sheet on a phone, from the top bar, over the view, and closes back to it", async () => {
    setMedia(PHONE);
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/inspect\/s_mock_0001\/latest$/));
    const dialog = await screen.findByRole("dialog", { name: "Turn latest" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(window.location.hash).toBe("#/console"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("docks beside the view from 1024 px, as a complementary region outside main, with a drag handle", async () => {
    setMedia(DESKTOP);
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    const aside = await screen.findByRole("complementary", { name: /Turn/ });
    expect(screen.getByRole("main").contains(aside)).toBe(false);
    expect(screen.getByRole("separator", { name: "Resize the inspector" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens straight from an address, over the view that was showing", async () => {
    setMedia(DESKTOP);
    window.location.hash = "#/inspect/s_mock_0001/t3?tab=raw";
    render(<AppFrame />);
    expect(await screen.findByRole("complementary", { name: "Turn t3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close inspector" })).toHaveAttribute("aria-pressed", "true");
  });

  it("names the newest turn when a turn exists", async () => {
    setMedia(DESKTOP);
    act(() => useAppStore.setState({ turns: [makeTurn("t4")] }));
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    await waitFor(() => expect(window.location.hash).toBe("#/inspect/s_mock_0001/t4"));
  });

  it("closes to the view it was opened over, not always the console", async () => {
    setMedia(DESKTOP);
    const user = userEvent.setup();
    window.location.hash = "#/metrics";
    render(<AppFrame />);
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    await screen.findByRole("complementary");
    await user.click(within(screen.getByRole("complementary")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(window.location.hash).toBe("#/metrics"));
  });
});

describe("AppFrame: keys", () => {
  it("starts a new session with Ctrl or Cmd K, even while typing", async () => {
    const user = userEvent.setup();
    render(<AppFrame />);
    screen.getByRole("textbox").focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(newSession).toHaveBeenCalledTimes(1);
  });

  it("stops streaming on Escape when no layer is open", async () => {
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.keyboard("{Escape}");
    expect(stopStreaming).toHaveBeenCalledTimes(1);
  });

  it("gives Escape to the top layer first: a tooltip, then the menu; streaming is not stopped by either", async () => {
    setMedia(TABLET);
    const user = userEvent.setup();
    render(<AppFrame />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    // Focus is on the first control in the menu, the copy button, whose tooltip is open.
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(stopStreaming).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();

    // With nothing open, the same key reaches the page and stops a stream.
    await user.keyboard("{Escape}");
    expect(stopStreaming).toHaveBeenCalledTimes(1);
  });
});
