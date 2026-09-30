import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "./Tooltip";

afterEach(() => {
  vi.useRealTimers();
});

/**
 * jsdom has no PointerEvent, so fireEvent.pointerEnter(el, { pointerType }) silently
 * drops the pointer type. This builds the event by hand. React reads onPointerEnter and
 * onPointerLeave from pointerover and pointerout, so those are what is dispatched.
 */
function pointer(target: Element, kind: "enter" | "leave", pointerType: "mouse" | "touch" | "pen" = "mouse") {
  const event = new Event(kind === "enter" ? "pointerover" : "pointerout", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => void target.dispatchEvent(event));
}

describe("Tooltip: keyboard", () => {
  it("opens when the trigger takes keyboard focus and describes the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Copies the citation">
        <button>Copy</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Copies the citation");
    expect(screen.getByRole("button", { name: "Copy" })).toHaveAttribute("aria-describedby", tip.id);
  });

  it("closes on Escape, and the focus stays where it was", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Tip">
        <button>Trigger</button>
      </Tooltip>,
    );
    await user.tab();
    await screen.findByRole("tooltip");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: "Trigger" })).toHaveFocus();
  });

  it("closes when focus leaves, and stops describing the trigger", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip label="Tip">
          <button>First</button>
        </Tooltip>
        <button>Second</button>
      </>,
    );
    await user.tab();
    await screen.findByRole("tooltip");
    await user.tab();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: "First" })).not.toHaveAttribute("aria-describedby");
  });

  it("can leave the trigger undescribed when the label only repeats its name", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Close" describe={false}>
        <button aria-label="Close">x</button>
      </Tooltip>,
    );
    await user.tab();
    await screen.findByRole("tooltip");
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("aria-describedby");
  });

  it("keeps the trigger's own handlers and description", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <Tooltip label="Tip" describe={false}>
        <button onFocus={onFocus} aria-describedby="own">
          Trigger
        </button>
      </Tooltip>,
    );
    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Trigger" })).toHaveAttribute("aria-describedby", "own");
  });

  it("renders the trigger alone when disabled", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Tip" disabled>
        <button>Trigger</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("Tooltip: pointer", () => {
  const hoverable = (label = "Tip") => (
    <Tooltip label={label} delay={500}>
      <button>Trigger</button>
    </Tooltip>
  );

  it("waits 500 ms of rest before it opens", () => {
    vi.useFakeTimers();
    render(hoverable());
    pointer(screen.getByRole("button"), "enter", "mouse");

    act(() => void vi.advanceTimersByTime(499));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => void vi.advanceTimersByTime(2));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Tip");
  });

  it("does not open if the pointer leaves first", () => {
    vi.useFakeTimers();
    render(hoverable());
    const trigger = screen.getByRole("button");
    pointer(trigger, "enter", "mouse");
    act(() => void vi.advanceTimersByTime(200));
    pointer(trigger, "leave", "mouse");
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays open while the pointer moves onto the tooltip (WCAG 1.4.13, hoverable), and closes after it leaves", () => {
    vi.useFakeTimers();
    render(hoverable());
    const trigger = screen.getByRole("button");
    pointer(trigger, "enter", "mouse");
    act(() => void vi.advanceTimersByTime(600));
    const tip = screen.getByRole("tooltip");

    pointer(trigger, "leave", "mouse");
    act(() => void vi.advanceTimersByTime(50));
    pointer(tip, "enter", "mouse");
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    pointer(tip, "leave", "mouse");
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not open for a touch, which has no hover", () => {
    vi.useFakeTimers();
    render(hoverable());
    pointer(screen.getByRole("button"), "enter", "touch");
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("Tooltip: placement", () => {
  it("renders in the layer root, outside the trigger's own container", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tooltip label="Tip">
        <button>Trigger</button>
      </Tooltip>,
    );
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(container.contains(tip)).toBe(false);
    expect(tip.closest("#layer-root")).not.toBeNull();
  });

  it("is a fixed-position layer with a maximum width so it cannot widen the page", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label={"A very long explanation ".repeat(30)}>
        <button>Trigger</button>
      </Tooltip>,
    );
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveClass("fixed");
    expect(Number.parseFloat(tip.style.maxWidth)).toBeLessThanOrEqual(320);
  });
});
