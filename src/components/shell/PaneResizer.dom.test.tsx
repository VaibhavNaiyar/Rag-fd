import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PaneResizer } from "./PaneResizer";

function Host({ start = 480, onChange = () => undefined }: { start?: number; onChange?: (width: number) => void }) {
  const [width, setWidth] = useState(start);
  return (
    <PaneResizer
      value={width}
      min={360}
      max={720}
      defaultValue={480}
      onChange={(next) => {
        setWidth(next);
        onChange(next);
      }}
    />
  );
}

const separator = () => screen.getByRole("separator", { name: "Resize the inspector" });

/** jsdom has no PointerEvent or pointer capture: build the events by hand. */
function pointer(target: Element, type: "pointerdown" | "pointermove" | "pointerup", clientX: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, pointerId: 1, pointerType: "mouse" });
  act(() => void target.dispatchEvent(event));
}

describe("PaneResizer: semantics", () => {
  it("is a vertical separator with its value and its limits, and one tab stop", () => {
    render(<Host />);
    const handle = separator();
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "480");
    expect(handle).toHaveAttribute("aria-valuemin", "360");
    expect(handle).toHaveAttribute("aria-valuemax", "720");
    expect(handle).toHaveAttribute("aria-valuetext", "480 pixels wide");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("is a 1 px line with a wider target, and shows the resize cursor", () => {
    const { container } = render(<Host />);
    expect(separator()).toHaveClass("w-px", "cursor-col-resize", "touch-none");
    // Above the panes on either side, which are positioned too, so its target is not covered.
    expect(separator()).toHaveClass("relative", "z-chrome");
    expect(container.querySelector("span")?.className).toContain("-left-1");
  });
});

describe("PaneResizer: keyboard (the acceptance test)", () => {
  it("widens the pane 16 px with Left and narrows it 16 px with Right", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    separator().focus();
    await user.keyboard("{ArrowLeft}");
    expect(separator()).toHaveAttribute("aria-valuenow", "496");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(separator()).toHaveAttribute("aria-valuenow", "464");
    expect(onChange.mock.calls.map((call) => call[0])).toEqual([496, 480, 464]);
  });

  it("goes to the least and the most with Home and End", async () => {
    const user = userEvent.setup();
    render(<Host />);
    separator().focus();
    await user.keyboard("{Home}");
    expect(separator()).toHaveAttribute("aria-valuenow", "360");
    await user.keyboard("{End}");
    expect(separator()).toHaveAttribute("aria-valuenow", "720");
  });

  it("holds the width between the limits", async () => {
    const user = userEvent.setup();
    render(<Host start={712} />);
    separator().focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(separator()).toHaveAttribute("aria-valuenow", "720");
    await user.keyboard("{Home}{ArrowRight}");
    expect(separator()).toHaveAttribute("aria-valuenow", "360");
  });

  it("ignores other keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    separator().focus();
    await user.keyboard("a{Enter}{ArrowUp}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("PaneResizer: pointer drag (the acceptance test)", () => {
  it("makes the pane wider as the handle is dragged left, and narrower to the right", () => {
    render(<Host />);
    pointer(separator(), "pointerdown", 800);
    pointer(separator(), "pointermove", 750);
    expect(separator()).toHaveAttribute("aria-valuenow", "530");
    pointer(separator(), "pointermove", 850);
    expect(separator()).toHaveAttribute("aria-valuenow", "430");
  });

  it("measures from where the drag began, not from the last move", () => {
    render(<Host />);
    pointer(separator(), "pointerdown", 900);
    for (const x of [890, 870, 850, 800]) pointer(separator(), "pointermove", x);
    expect(separator()).toHaveAttribute("aria-valuenow", "580");
  });

  it("holds the width between the limits however far the pointer goes", () => {
    render(<Host />);
    pointer(separator(), "pointerdown", 800);
    pointer(separator(), "pointermove", 0);
    expect(separator()).toHaveAttribute("aria-valuenow", "720");
    pointer(separator(), "pointermove", 5000);
    expect(separator()).toHaveAttribute("aria-valuenow", "360");
  });

  it("does nothing on a move with no drag begun, and stops on release", () => {
    render(<Host />);
    pointer(separator(), "pointermove", 100);
    expect(separator()).toHaveAttribute("aria-valuenow", "480");
    pointer(separator(), "pointerdown", 800);
    pointer(separator(), "pointerup", 800);
    pointer(separator(), "pointermove", 700);
    expect(separator()).toHaveAttribute("aria-valuenow", "480");
  });

  it("captures the pointer, so the drag continues when it leaves the handle", () => {
    render(<Host />);
    const capture = vi.fn();
    separator().setPointerCapture = capture;
    pointer(separator(), "pointerdown", 800);
    expect(capture).toHaveBeenCalledWith(1);
  });

  it("works where pointer capture is not implemented", () => {
    render(<Host />);
    expect(() => pointer(separator(), "pointerdown", 800)).not.toThrow();
  });
});

describe("PaneResizer: reset", () => {
  it("returns to the default on a double click", () => {
    render(<Host start={600} />);
    fireEvent.doubleClick(separator());
    expect(separator()).toHaveAttribute("aria-valuenow", "480");
  });
});
