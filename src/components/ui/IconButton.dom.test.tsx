import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";

const mark = <svg data-testid="mark" />;

describe("IconButton", () => {
  it("is named by its label, and the icon is hidden from assistive technology", () => {
    render(<IconButton label="Show sessions" icon={mark} />);
    expect(screen.getByRole("button", { name: "Show sessions" })).toBeInTheDocument();
    expect(screen.getByTestId("mark").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("has no title attribute: the tooltip replaces it", () => {
    render(<IconButton label="Close" icon={mark} />);
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("title");
  });

  describe("aria-pressed (audit A-01)", () => {
    it("is absent on a plain button, so it is not announced as a toggle", () => {
      render(<IconButton label="Close" icon={mark} />);
      expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("aria-pressed");
    });

    it("is written only when `pressed` is given, true or false", () => {
      render(
        <>
          <IconButton label="On" icon={mark} pressed />
          <IconButton label="Off" icon={mark} pressed={false} />
        </>,
      );
      expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false");
    });

    it("still honours the previous prop name", () => {
      render(<IconButton label="Legacy" icon={mark} active />);
      expect(screen.getByRole("button", { name: "Legacy" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("does not describe itself with its own name: the tooltip is visual only", async () => {
    const user = userEvent.setup();
    render(<IconButton label="Hide sessions" icon={mark} />);
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Hide sessions");
    expect(screen.getByRole("button", { name: "Hide sessions" })).not.toHaveAttribute("aria-describedby");
  });

  it("runs onClick, and not when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<IconButton label="Go" icon={mark} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<IconButton label="Go" icon={mark} onClick={onClick} disabled />);
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses the control-size tokens, 44 px on touch", () => {
    render(
      <>
        <IconButton label="Small" icon={mark} size="sm" />
        <IconButton label="Medium" icon={mark} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("size-control-sm");
    expect(screen.getByRole("button", { name: "Medium" })).toHaveClass("size-control");
  });

  it("marks itself as chrome so the focus ring is the one drawn for the navy bar", () => {
    render(<IconButton label="Theme" icon={mark} surface="chrome" />);
    expect(screen.getByRole("button", { name: "Theme" })).toHaveAttribute("data-surface", "chrome");
  });

  it("can drop the tooltip", async () => {
    const user = userEvent.setup();
    render(<IconButton label="Quiet" icon={mark} tooltip={false} />);
    await user.tab();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
