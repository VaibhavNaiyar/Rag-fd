import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveRegion, SkipLink, VisuallyHidden, announce } from "./a11y";
import { copyText } from "./clipboard";
import { ToastProvider, useToast, type ToastOptions } from "./Toast";

/** What a screen reader would be told: the text of the two live regions the announcer keeps in the layer root. */
const said = (politeness: "polite" | "assertive" = "polite") =>
  document.querySelector<HTMLElement>(`#layer-root [aria-live="${politeness}"]`)?.textContent ?? "";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const region of document.querySelectorAll("#layer-root [aria-live]")) region.textContent = "";
});

describe("VisuallyHidden, LiveRegion, SkipLink", () => {
  it("VisuallyHidden takes no room but stays in the accessibility tree", () => {
    render(<VisuallyHidden>For screen readers</VisuallyHidden>);
    expect(screen.getByText("For screen readers")).toHaveClass("sr-only");
  });

  it("LiveRegion is a polite status by default and an alert when assertive", () => {
    const { rerender } = render(<LiveRegion>Saved</LiveRegion>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    rerender(<LiveRegion politeness="assertive">Failed</LiveRegion>);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("SkipLink moves focus to its target and does not touch the URL hash the router owns", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/console";
    render(
      <>
        <SkipLink targetId="main" />
        <main id="main" tabIndex={-1}>
          Content
        </main>
      </>,
    );
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveClass("sr-only");
    await user.click(link);
    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe("#/console");
  });

  it("SkipLink becomes visible when it takes keyboard focus", () => {
    render(<SkipLink targetId="main" />);
    expect(screen.getByRole("link").className).toContain("focus:not-sr-only");
  });
});

describe("announce", () => {
  it("says a polite message in the polite region and an assertive one in the alert region", () => {
    announce("Copied");
    announce("Copy failed", "assertive");
    expect(said("polite")).toBe("Copied");
    expect(said("assertive")).toBe("Copy failed");
  });

  it("keeps its regions in the layer root, which is never made inert", () => {
    announce("Hello");
    expect(document.querySelector("#layer-root [aria-live='polite']")).not.toBeNull();
    expect(document.querySelector("#layer-root [aria-live='polite']")?.closest("[inert]")).toBeNull();
  });

  it("announces the same message twice in a row", async () => {
    announce("Copied");
    announce("Copied");
    await waitFor(() => expect(said()).toBe("Copied"));
  });
});

describe("copyText", () => {
  it("uses the async Clipboard API where it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.stubGlobal("isSecureContext", true);
    expect(await copyText("abc")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("abc");
  });

  it("falls back to a selection and execCommand where the API is missing", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    expect(await copyText("abc")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when the API refuses", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.stubGlobal("isSecureContext", true);
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    expect(await copyText("abc")).toBe(true);
    expect(exec).toHaveBeenCalled();
  });

  it("reports failure when nothing works", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn().mockReturnValue(false) });
    expect(await copyText("abc")).toBe(false);
  });

  it("puts focus back where it was after the fallback", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn().mockReturnValue(true) });
    render(<button>Anchor</button>);
    screen.getByRole("button").focus();
    await copyText("abc");
    expect(screen.getByRole("button")).toHaveFocus();
  });
});

describe("Toast", () => {
  // The announcer repeats every toast's text in a hidden live region, so look in the toast region only.
  const notifications = () => screen.queryByRole("region", { name: "Notifications" });
  const shown = (text: string) => notifications()?.textContent?.includes(text) ?? false;

  function Trigger({ options, label = "Notify" }: { options: ToastOptions; label?: string }) {
    const { toast } = useToast();
    return <button onClick={() => toast(options)}>{label}</button>;
  }

  function setup(options: ToastOptions = { message: "Session reset" }, max?: number) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider max={max}>
        <Trigger options={options} />
      </ToastProvider>,
    );
    return user;
  }

  it("shows a toast in a labelled region, and announces it (the acceptance test)", async () => {
    const user = setup({ title: "Done", message: "Session reset" });
    await user.click(screen.getByRole("button", { name: "Notify" }));
    expect(notifications()).toHaveTextContent("Session reset");
    expect(said()).toBe("Done. Session reset");
  });

  it("announces an error assertively", async () => {
    const user = setup({ message: "Engine unreachable", tone: "error" });
    await user.click(screen.getByRole("button", { name: "Notify" }));
    expect(said("assertive")).toBe("Engine unreachable");
  });

  it("has no region, and no landmark noise, when there is nothing to show", () => {
    setup();
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });

  it("goes away after 4 seconds", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Notify" }));
    expect(shown("Session reset")).toBe(true);
    await act(async () => void vi.advanceTimersByTime(3900));
    expect(shown("Session reset")).toBe(true);
    await act(async () => void vi.advanceTimersByTime(200));
    expect(shown("Session reset")).toBe(false);
  });

  it("stays while the pointer is over it, and leaves after the time that was left once the pointer goes", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Notify" }));
    await act(async () => void vi.advanceTimersByTime(3000));

    const toast = notifications()?.querySelector("[class*='pointer-events-auto']") as HTMLElement;
    const hover = (kind: "pointerover" | "pointerout") => {
      const event = new Event(kind, { bubbles: true });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      act(() => void toast.dispatchEvent(event));
    };
    hover("pointerover");
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(shown("Session reset")).toBe(true);

    hover("pointerout");
    await act(async () => void vi.advanceTimersByTime(900));
    expect(shown("Session reset")).toBe(true);
    await act(async () => void vi.advanceTimersByTime(200));
    expect(shown("Session reset")).toBe(false);
  });

  it("stays while something inside it has keyboard focus", async () => {
    const user = setup({ message: "Trace opened", action: { label: "Undo", onAction: () => undefined } });
    await user.click(screen.getByRole("button", { name: "Notify" }));
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    await act(async () => void vi.advanceTimersByTime(30_000));
    expect(shown("Trace opened")).toBe(true);
  });

  it("never takes focus from the reader", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.getByRole("button", { name: "Notify" })).toHaveFocus();
  });

  it("dismisses with its button, and runs an action then dismisses", async () => {
    const onAction = vi.fn();
    const user = setup({ message: "Trace opened", action: { label: "Undo", onAction } });
    await user.click(screen.getByRole("button", { name: "Notify" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(shown("Trace opened")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Notify" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(shown("Trace opened")).toBe(false);
  });

  it("shows at most three, and the next one when a slot frees", async () => {
    const user = setup({ message: "Toast" });
    const notify = screen.getByRole("button", { name: "Notify" });
    for (let n = 0; n < 5; n += 1) await user.click(notify);
    const count = () => notifications()?.querySelectorAll("p").length ?? 0;
    expect(count()).toBe(3);

    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0] as HTMLElement);
    expect(count()).toBe(3);
    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0] as HTMLElement);
    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0] as HTMLElement);
    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0] as HTMLElement);
    expect(count()).toBe(1);
  });

  it("sits above the tab bar on a phone and never blocks the page around it", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Notify" }));
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveClass("pointer-events-none", "fixed", "z-toast");
    expect(region.className).toContain("max-md:pb-[calc(var(--tabbar-h)");
  });

  it("does nothing, without error, when used outside a provider", async () => {
    const user = userEvent.setup();
    render(<Trigger options={{ message: "x" }} />);
    await user.click(screen.getByRole("button", { name: "Notify" }));
    expect(notifications()).toBeNull();
  });
});
