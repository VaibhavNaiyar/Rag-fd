import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthResult } from "@/lib/health";
import { useAppStore } from "@/store/useAppStore";
import { TopBar } from "./TopBar";

const OK: HealthResult = { state: "ok", at: 1, health: { version: "0.3.0", corpus: null, models: {} } };

function setup(props: { inspectorOpen?: boolean; onToggleInspector?: () => void } = {}) {
  const onToggleInspector = props.onToggleInspector ?? vi.fn();
  render(<TopBar health={OK} inspectorOpen={props.inspectorOpen ?? false} onToggleInspector={onToggleInspector} />);
  return { onToggleInspector };
}

beforeEach(() => {
  window.localStorage.setItem("slr.theme", "light");
  act(() => useAppStore.setState({ connection: "open", corpus: { docs: 12, chunks: 96 }, turns: [], shared: null, newSession: vi.fn() }));
});

describe("TopBar: the bar", () => {
  it("is the page's banner, on the navy chrome, with the product name as text", () => {
    setup();
    const banner = screen.getByRole("banner");
    expect(banner).toHaveAttribute("data-surface", "chrome");
    expect(banner).toHaveClass("bg-chrome", "frame-top", "pt-safe-top", "pl-safe-left", "pr-safe-right");
    expect(within(banner).getByText("Streaming Live RAG")).toHaveClass("truncate");
    expect(banner.querySelector("img, svg[role='img']")).toBeNull();
  });

  it("is 48 px tall (44 on a phone, by the token), with a chrome hairline under it", () => {
    setup();
    const row = screen.getByRole("banner").firstElementChild as HTMLElement;
    expect(row).toHaveClass("h-topbar", "border-b", "border-chrome-line");
  });

  it("shows the connection state, collapsing to the mark below 480 px", () => {
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("Engine live");
    expect(screen.getByText("Engine live")).toHaveClass("sr-only", "sm:not-sr-only");
  });
});

describe("TopBar: the Inspector toggle", () => {
  it("is a toggle button that says what it will do, and whether it is on", () => {
    const { rerender } = render(<TopBar health={OK} inspectorOpen={false} onToggleInspector={() => undefined} />);
    expect(screen.getByRole("button", { name: "Open inspector" })).toHaveAttribute("aria-pressed", "false");
    rerender(<TopBar health={OK} inspectorOpen onToggleInspector={() => undefined} />);
    expect(screen.getByRole("button", { name: "Close inspector" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls back when pressed", async () => {
    const user = userEvent.setup();
    const { onToggleInspector } = setup();
    await user.click(screen.getByRole("button", { name: "Open inspector" }));
    expect(onToggleInspector).toHaveBeenCalledTimes(1);
  });
});

describe("TopBar: new session and theme, from 768 px", () => {
  it("has a New session button with the platform's shortcut hint, which starts a new session", async () => {
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole("button", { name: /New session/ });
    expect(button).toHaveClass("hidden", "md:inline-flex");
    expect(within(button).getByRole("group")).toHaveAttribute("aria-label", "Control K");
    await user.click(button);
    expect(useAppStore.getState().newSession).toHaveBeenCalledTimes(1);
  });

  it("cycles the theme with a button that names the current one", async () => {
    const user = userEvent.setup();
    setup();
    const toggle = screen.getByRole("button", { name: "Theme: light" });
    expect(toggle).toHaveClass("hidden", "md:inline-flex");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Theme: dark" })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("draws every icon button on the chrome with the chrome focus ring", () => {
    setup();
    for (const name of ["Open inspector", "Theme: light", "Menu"]) expect(screen.getByRole("button", { name })).toHaveAttribute("data-surface", "chrome");
  });
});

describe("TopBar: the menu, below 768 px (375 px: a name and three icons)", () => {
  it("is a button that opens a dialog named Menu, and says it is open", async () => {
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveClass("md:hidden");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("has the status facts in it: the same ones the strip shows on a wide screen", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.setState({ shared: { session: { id: "s_mock_0004", corpus: { docs: 12, chunks: 96 } }, turns: {} } }));
    setup();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByRole("heading", { name: "Status" })).toBeInTheDocument();
    expect(within(dialog).getByText("s_mock_0004")).toBeInTheDocument();
    expect(within(dialog).getByText("Engine ok, version 0.3.0")).toBeInTheDocument();
  });

  it("has the theme choice, which changes the theme", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("has a New session button, which starts one and closes the menu", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "New session" }));
    expect(useAppStore.getState().newSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and gives focus back to the Menu button", async () => {
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("is no wider than the phone: a 320 px panel that is capped at the width available", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog).toHaveClass("w-80", "max-w-full");
    expect(dialog.style.maxWidth).not.toBe("");
  });
});
