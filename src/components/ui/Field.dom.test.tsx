import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";
import { Select } from "./Select";
import { fitTextarea, Textarea } from "./Textarea";

describe("Field: label association", () => {
  it("names the control with its label, so a click on the label focuses it", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Session name">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Session name");
    expect(input.tagName).toBe("INPUT");
    await user.click(screen.getByText("Session name"));
    expect(input).toHaveFocus();
  });

  it("names a textarea and a select the same way", () => {
    render(
      <>
        <Field label="Notes">
          <Textarea />
        </Field>
        <Field label="Corpus">
          <Select>
            <option>Enterprise</option>
          </Select>
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Corpus").tagName).toBe("SELECT");
  });

  it("gives two fields two different ids", () => {
    render(
      <>
        <Field label="First">
          <Input />
        </Field>
        <Field label="Second">
          <Input />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("First").id).not.toBe(screen.getByLabelText("Second").id);
  });

  it("keeps the label for assistive technology when it is hidden", () => {
    render(
      <Field label="Filter turns" hideLabel>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Filter turns")).toBeInTheDocument();
    expect(screen.getByText("Filter turns")).toHaveClass("sr-only");
  });
});

describe("Field: description and error", () => {
  it("attaches the description to the control with aria-describedby", () => {
    render(
      <Field label="Speed" description="Replay speed, 0.5 to 2">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Speed");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByText("Replay speed, 0.5 to 2").id);
  });

  it("says an invalid value is invalid with an icon and words, not only a colour", () => {
    const { container } = render(
      <Field label="Speed" error="Enter a number between 0.5 and 2">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Speed");
    const error = screen.getByRole("alert");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(error).toHaveTextContent("Enter a number between 0.5 and 2");
    expect(error.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
    expect(input).toHaveClass("border-error");
    expect(container.querySelector('[role="alert"] svg')).not.toBeNull();
  });

  it("lists the description and the error together, description first", () => {
    render(
      <Field label="Speed" description="Hint" error="Problem">
        <Input />
      </Field>,
    );
    const ids = (screen.getByLabelText("Speed").getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toEqual([screen.getByText("Hint").id, screen.getByRole("alert").id]);
  });

  it("is not invalid, and has no alert, without an error", () => {
    render(
      <Field label="Speed">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Speed")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("marks a required field with aria-required and a star hidden from assistive technology", () => {
    render(
      <Field label="Query" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Query/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("wraps a long unbroken error instead of widening the field", () => {
    render(
      <Field label="Id" error={"x".repeat(200)}>
        <Input />
      </Field>,
    );
    expect(screen.getByRole("alert").querySelector("span")).toHaveClass("break-words", "min-w-0");
  });
});

describe("Input, Textarea, Select on their own", () => {
  it("work without a Field, and keep the attributes they are given", () => {
    render(<Input aria-label="Bare" placeholder="Type" invalid />);
    const input = screen.getByLabelText("Bare");
    expect(input).toHaveAttribute("placeholder", "Type");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("merge their own aria-describedby with the Field's", () => {
    render(
      <Field label="Speed" description="Hint">
        <Input aria-describedby="extra" />
      </Field>,
    );
    const ids = (screen.getByLabelText("Speed").getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toContain("extra");
    expect(ids).toContain(screen.getByText("Hint").id);
  });

  it("are 32 px tall (44 px on touch) with a 3:1 outline, or the error outline", () => {
    render(
      <>
        <Input aria-label="Plain" />
        <Input aria-label="Wrong" invalid />
      </>,
    );
    expect(screen.getByLabelText("Plain")).toHaveClass("h-control", "border-line-control");
    expect(screen.getByLabelText("Wrong")).toHaveClass("border-error");
  });

  it("forward refs and take input", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(<Input ref={ref} aria-label="Typed" onChange={onChange} />);
    await user.type(screen.getByLabelText("Typed"), "abc");
    expect(ref.current?.value).toBe("abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe("Textarea", () => {
  // jsdom gives a textarea its own padding and border. Take them away so heights are exactly lines x 20 px.
  beforeEach(() => {
    const style = document.createElement("style");
    style.id = "textarea-test-style";
    style.textContent = "textarea { padding: 0; border-width: 0; line-height: 20px; }";
    document.head.appendChild(style);
  });
  afterEach(() => document.getElementById("textarea-test-style")?.remove());

  function withScrollHeight(element: HTMLTextAreaElement, scrollHeight: number) {
    Object.defineProperty(element, "scrollHeight", { configurable: true, get: () => scrollHeight });
  }

  it("grows with its content", () => {
    render(<Textarea aria-label="Notes" minRows={2} maxRows={6} />);
    const area = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    withScrollHeight(area, 90);
    fitTextarea(area, 6);
    expect(area.style.height).toBe("90px");
    expect(area.style.overflowY).toBe("hidden");
  });

  it("stops growing at maxRows and scrolls", () => {
    render(<Textarea aria-label="Notes" />);
    const area = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    withScrollHeight(area, 500);
    fitTextarea(area, 4);
    expect(area.style.height).toBe("80px");
    expect(area.style.overflowY).toBe("auto");
  });

  it("starts at minRows and does not let the browser resize it by hand", () => {
    render(<Textarea aria-label="Notes" minRows={3} />);
    const area = screen.getByLabelText("Notes");
    expect(area).toHaveAttribute("rows", "3");
    expect(area).toHaveClass("resize-none");
  });

  it("re-fits when its value is changed from outside (a cleared composer)", async () => {
    const user = userEvent.setup();
    // jsdom does no layout: one 20 px line per line of text.
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return this.value.split("\n").length * 20;
      },
    });
    try {
      function Controlled() {
        const [value, setValue] = useState("one\ntwo\nthree");
        return (
          <>
            <Textarea aria-label="Notes" value={value} onChange={(event) => setValue(event.target.value)} />
            <button onClick={() => setValue("")}>Clear</button>
          </>
        );
      }
      render(<Controlled />);
      const area = screen.getByLabelText("Notes") as HTMLTextAreaElement;
      expect(area.style.height).toBe("60px");
      await user.click(screen.getByRole("button", { name: "Clear" }));
      expect(area.style.height).toBe("20px");
    } finally {
      Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
    }
  });

  it("forwards its ref to the textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Notes" />);
    expect(ref.current).toBe(screen.getByLabelText("Notes"));
  });
});

describe("Select", () => {
  it("is a native select with a chevron that is hidden from assistive technology", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Field label="Corpus">
        <Select onChange={onChange}>
          <option value="enterprise">Enterprise</option>
          <option value="asqa">ASQA</option>
        </Select>
      </Field>,
    );
    await user.selectOptions(screen.getByLabelText("Corpus"), "asqa");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
