import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeyValueGrid } from "./KeyValueGrid";
import { MetricCell } from "./MetricCell";
import { Stat } from "./Stat";

describe("MetricCell in a KeyValueGrid", () => {
  function Grid({ columns }: { columns?: 1 | 2 | 3 | 4 }) {
    return (
      <KeyValueGrid label="Turn t3 timings" columns={columns}>
        <MetricCell label="TTFT" value="1,240" unit="ms" hint="from utterance end" provenance="measured" />
        <MetricCell label="Lead" value="620" unit="ms" tone="ok" />
        <MetricCell label="Cost" value={null} />
      </KeyValueGrid>
    );
  }

  it("is a description list of terms and definitions, named for assistive technology", () => {
    const { container } = render(<Grid />);
    const list = container.querySelector("dl") as HTMLElement;
    expect(list).toHaveAttribute("aria-label", "Turn t3 timings");
    expect([...list.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["TTFT", "Lead", "Cost"]);
    expect(list.querySelectorAll("dd").length).toBeGreaterThanOrEqual(3);
    for (const group of list.children) expect(group.tagName).toBe("DIV");
  });

  it("puts the value in the monospace face with its unit and its hint", () => {
    render(<Grid />);
    const value = screen.getByText("1,240");
    expect(value.closest("dd")).toHaveClass("font-mono", "tabular");
    expect(screen.getAllByText("ms")).toHaveLength(2);
    expect(screen.getByText("from utterance end")).toBeInTheDocument();
  });

  it("says where a number came from", () => {
    render(<Grid />);
    expect(screen.getByText("measured")).toBeInTheDocument();
  });

  it("shows a missing value as a dash and marks it unavailable: it never becomes zero (R6)", () => {
    render(<Grid />);
    const cost = screen.getByText("Cost").parentElement as HTMLElement;
    expect(cost).toHaveTextContent("—");
    expect(cost).toHaveTextContent("unavailable");
    expect(cost).not.toHaveTextContent("0");
  });

  it("colours a value by its tone with the text ink tokens, and never a missing one", () => {
    render(<Grid />);
    expect(screen.getByText("620").closest("dd")).toHaveClass("text-ok-ink");
    expect(screen.getByText("—").closest("dd")).toHaveClass("text-ink");
  });

  it("wraps a long value instead of widening its cell", () => {
    render(
      <KeyValueGrid>
        <MetricCell label="Id" value={"x".repeat(200)} />
      </KeyValueGrid>,
    );
    expect(screen.getByText("x".repeat(200))).toHaveClass("break-words", "min-w-0");
  });

  it("chooses its columns from its own width unless a count is given", () => {
    const { container, rerender } = render(<Grid />);
    expect(container.firstElementChild).toHaveClass("kv");
    expect(container.firstElementChild).not.toHaveAttribute("data-cols");
    rerender(<Grid columns={2} />);
    expect(container.firstElementChild).toHaveAttribute("data-cols", "2");
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--kv-cols")).toBe("2");
  });
});

describe("MetricCell on its own", () => {
  it("is plain text, not a term and a definition, outside a grid", () => {
    const { container } = render(<MetricCell label="TTFT" value="640" unit="ms" />);
    expect(container.querySelector("dt, dd")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("marks an empty string as missing too", () => {
    const { container } = render(<MetricCell label="Lead" value="" />);
    expect(container).toHaveTextContent("—");
    expect(container).toHaveTextContent("unavailable");
  });

  it("draws a hairline above the cell, on the 4 px grid", () => {
    const { container } = render(<MetricCell label="A" value="1" />);
    expect(container.firstElementChild).toHaveClass("border-t", "border-line", "pt-2");
  });
});

describe("Stat (the old name of MetricCell)", () => {
  it("keeps its props and its tones", () => {
    const { container } = render(<Stat label="Mean TTFT" value="1.2s" hint="from utterance end" tone="primary" />);
    expect(container).toHaveTextContent("Mean TTFT");
    expect(container).toHaveTextContent("1.2s");
    expect(container).toHaveTextContent("from utterance end");
    expect(screen.getByText("1.2s").closest("p")).toHaveClass("text-accent-ink");
  });
});
