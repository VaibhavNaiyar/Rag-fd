import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, type ButtonVariant } from "./Button";

describe("Button", () => {
  it("is a real button that does not submit a form unless asked to", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("runs onClick with the mouse and with Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run</Button>);
    const button = screen.getByRole("button", { name: "Run" });

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing when disabled, and cannot be reached with the keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Run</Button>);
    await user.click(screen.getByRole("button", { name: "Run" }));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Run" })).not.toHaveFocus();
  });

  describe("loading", () => {
    it("says it is busy, ignores clicks and keeps focus", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button loading onClick={onClick}>Send</Button>);
      const button = screen.getByRole("button", { name: /send/i });

      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      button.focus();
      await user.keyboard("{Enter}");
      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
      expect(button).toHaveFocus();
    });

    it("keeps the label in the layout, hidden, so the width does not change, and shows a spinner", () => {
      render(<Button loading>Send message</Button>);
      const label = screen.getByText("Send message");
      expect(label.closest("span")).toHaveClass("invisible");
      expect(screen.getByRole("status")).toHaveTextContent("Working");
    });

    it("is not marked busy when it is not loading", () => {
      render(<Button>Send</Button>);
      const button = screen.getByRole("button");
      expect(button).not.toHaveAttribute("aria-busy");
      expect(button).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("variants", () => {
    const cases: [ButtonVariant, string][] = [
      ["primary", "bg-accent"],
      ["neutral", "bg-control"],
      ["secondary", "border-line-control"],
      ["ghost", "bg-transparent"],
      ["danger", "text-error-ink"],
    ];
    it.each(cases)("%s uses its token class %s", (variant, expected) => {
      render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole("button")).toHaveClass(expected);
    });

    it("keeps the previous names working, drawn as secondary", () => {
      render(
        <>
          <Button variant="subtle">Subtle</Button>
          <Button variant="outline">Outline</Button>
        </>,
      );
      expect(screen.getByRole("button", { name: "Subtle" })).toHaveClass("border-line-control");
      expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("border-line-control");
    });

    it("draws no raw colour and no pill radius", () => {
      render(<Button variant="primary">Go</Button>);
      const classes = screen.getByRole("button").className;
      expect(classes).not.toMatch(/#|rgb|rounded-full|rounded-pill/);
      expect(classes).toContain("rounded-2");
    });
  });

  it("uses the control-height tokens, which become 44 px on a touch screen", () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("h-control-sm");
    expect(screen.getByRole("button", { name: "Medium" })).toHaveClass("h-control");
  });

  it("hides its icon from assistive technology", () => {
    render(<Button icon={<svg data-testid="mark" />}>Add</Button>);
    expect(screen.getByTestId("mark").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("forwards a ref and passes other attributes through", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <Button ref={ref} data-testid="x" aria-describedby="hint">
        Go
      </Button>,
    );
    expect(ref.current).toBe(screen.getByTestId("x"));
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
  });
});
