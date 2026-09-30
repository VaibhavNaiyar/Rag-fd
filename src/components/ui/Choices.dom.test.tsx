import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";
import { Segmented } from "./Segmented";
import { Switch } from "./Switch";

describe("Switch", () => {
  function Host({ disabled = false, onChange = () => undefined }: { disabled?: boolean; onChange?: (checked: boolean) => void }) {
    const [on, setOn] = useState(false);
    return (
      <Switch
        label="Show timing table"
        description="Adds a table beside each chart"
        checked={on}
        disabled={disabled}
        onCheckedChange={(next) => {
          setOn(next);
          onChange(next);
        }}
      />
    );
  }

  it("is a switch named by its label alone, not by its description", () => {
    render(<Host />);
    const toggle = screen.getByRole("switch", { name: "Show timing table" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle.getAttribute("aria-describedby")).toBe(screen.getByText("Adds a table beside each chart").id);
  });

  it("toggles with the Space key (the acceptance test)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const toggle = screen.getByRole("switch");
    toggle.focus();
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(onChange.mock.calls.map((call) => call[0])).toEqual([true, false]);
  });

  it("also toggles with Enter, and with a click on the button or on its label text", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const toggle = screen.getByRole("switch");
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByText("Show timing table"));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host disabled onChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("has a target 32 px tall that is 44 px on touch, and shows state by position as well as colour", () => {
    const { container } = render(<Host />);
    expect(container.querySelector("label")).toHaveClass("min-h-control");
    const knob = container.querySelector("button span") as HTMLElement;
    expect(knob).toHaveClass("translate-x-0");
  });

  it("moves the knob when on", async () => {
    const user = userEvent.setup();
    const { container } = render(<Host />);
    await user.click(screen.getByRole("switch"));
    expect(container.querySelector("button span")).toHaveClass("translate-x-4");
  });

  it("draws no pill: the track is a 6 px-radius rectangle, the knob 4 px", () => {
    const { container } = render(<Host />);
    expect(container.innerHTML).not.toContain("rounded-full");
    expect(screen.getByRole("switch")).toHaveClass("rounded-3");
  });
});

describe("Checkbox", () => {
  function Host({ indeterminate = false }: { indeterminate?: boolean }) {
    const [on, setOn] = useState(false);
    return <Checkbox label="Select all turns" checked={on} indeterminate={indeterminate} onCheckedChange={setOn} />;
  }

  it("is a checkbox named by its label", () => {
    render(<Host />);
    expect((screen.getByRole("checkbox", { name: "Select all turns" }) as HTMLInputElement).checked).toBe(false);
  });

  it("toggles with the Space key, and with a click on the label", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    box.focus();
    await user.keyboard(" ");
    expect(box.checked).toBe(true);
    await user.click(screen.getByText("Select all turns"));
    expect(box.checked).toBe(false);
  });

  it("shows a check mark when checked, and a dash when mixed", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<Host />);
    expect(container.querySelector("svg")).toBeNull();
    await user.click(screen.getByRole("checkbox"));
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<Host indeterminate />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Locked" checked={false} disabled onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("keeps the native input for focus and keys, and draws the box beside it with the focus ring", () => {
    const { container } = render(<Host />);
    const box = container.querySelector("input") as HTMLElement;
    expect(box).toHaveClass("peer");
    expect(container.querySelector("input + span")?.className).toContain("peer-focus-visible:outline");
  });
});

describe("Segmented", () => {
  const OPTIONS = [
    { value: "compact", label: "Compact" },
    { value: "default", label: "Default" },
    { value: "touch", label: "Touch", disabled: true },
    { value: "wide", label: "Wide" },
  ] as const;

  function Host({ onChange = () => undefined }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState<(typeof OPTIONS)[number]["value"]>("default");
    return (
      <>
        <button>Before</button>
        <Segmented
          label="Density"
          options={OPTIONS}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
        <button>After</button>
      </>
    );
  }

  it("is a named radio group of radios, one checked", () => {
    render(<Host />);
    expect(screen.getByRole("radiogroup", { name: "Density" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true").map((radio) => radio.textContent)).toEqual(["Default"]);
  });

  it("is one tab stop: Tab enters on the checked radio and leaves after it", async () => {
    const user = userEvent.setup();
    render(<Host />);
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Default" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("moves and chooses with the arrow keys (the acceptance test), wrapping, and skipping the disabled option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    screen.getByRole("radio", { name: "Default" }).focus();

    await user.keyboard("{ArrowRight}");
    // Past the disabled "Touch".
    expect(screen.getByRole("radio", { name: "Wide" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Wide" })).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Compact" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Wide" })).toHaveFocus();
    expect(onChange.mock.calls.map((call) => call[0])).toEqual(["wide", "compact", "wide"]);
  });

  it("goes to the ends with Home and End, and also answers Up and Down", async () => {
    const user = userEvent.setup();
    render(<Host />);
    screen.getByRole("radio", { name: "Default" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Wide" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Compact" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Default" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Compact" })).toHaveFocus();
  });

  it("chooses on click, but not a disabled option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Compact" }));
    await user.click(screen.getByRole("radio", { name: "Touch" }));
    expect(onChange.mock.calls.map((call) => call[0])).toEqual(["compact"]);
  });

  it("lets each option shrink and truncate instead of widening the row at 375 px", () => {
    render(<Host />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveClass("max-w-full", "min-w-0");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveClass("min-w-0");
    expect(screen.getByText("Compact")).toHaveClass("truncate");
  });

  it("uses the 28 px control height by default, 32 px when asked, both 44 on touch", () => {
    const { rerender } = render(<Segmented label="A" options={OPTIONS} value="default" onValueChange={() => undefined} />);
    expect(screen.getAllByRole("radio")[0]).toHaveClass("h-control-sm");
    rerender(<Segmented label="A" options={OPTIONS} value="default" onValueChange={() => undefined} size="md" />);
    expect(screen.getAllByRole("radio")[0]).toHaveClass("h-control");
  });
});
