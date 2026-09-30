import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "./CodeBlock";
import { JsonViewer } from "./JsonViewer";

const RECORD = {
  turn_id: "t3",
  latency_ms: { first_token_abs: 1240, complete_abs: 2810 },
  retrieval: [{ sub_query_id: "t3_sq1", kept: [{ chunk_id: "Doc_11_0", score: 0.83 }] }],
  degraded: false,
  uncertainty: null,
};

const rows = () => screen.getAllByRole("treeitem");
const row = (name: RegExp | string) => rows().find((item) => (typeof name === "string" ? item.textContent === name : name.test(item.textContent ?? ""))) as HTMLElement;

describe("JsonViewer: structure", () => {
  it("is a named tree with the root and its children open to begin with", () => {
    render(<JsonViewer label="Trace record t3" value={RECORD} />);
    expect(screen.getByRole("tree", { name: "Trace record t3" })).toBeInTheDocument();
    expect(rows().map((item) => item.getAttribute("aria-level"))).toEqual(["1", "2", "2", "2", "2", "2"]);
    expect(row(/^turn_id:/)).toHaveTextContent('"t3"');
    expect(row(/^latency_ms:/)).toHaveAttribute("aria-expanded", "false");
    expect(row(/^turn_id:/)).not.toHaveAttribute("aria-expanded");
  });

  it("tells each row its place among its siblings", () => {
    render(<JsonViewer label="r" value={RECORD} />);
    const third = row(/^retrieval:/);
    expect(third).toHaveAttribute("aria-posinset", "3");
    expect(third).toHaveAttribute("aria-setsize", "5");
  });

  it("summarises a closed collection with its size, in the muted colour", () => {
    render(<JsonViewer label="r" value={RECORD} />);
    expect(row(/^latency_ms:/)).toHaveTextContent("2 keys");
    expect(row(/^retrieval:/)).toHaveTextContent("1 item");
  });

  it("can start with more or fewer levels open", () => {
    const { rerender } = render(<JsonViewer label="r" value={RECORD} defaultExpandDepth={0} />);
    expect(rows()).toHaveLength(1);
    rerender(<JsonViewer key="deep" label="r" value={RECORD} defaultExpandDepth={2} />);
    expect(rows().length).toBeGreaterThan(6);
  });

  it("draws numbers in the accent ink and quotes strings", () => {
    render(<JsonViewer label="r" value={RECORD} defaultExpandDepth={3} />);
    expect(within(row(/^first_token_abs:/)).getByText("1240")).toHaveClass("text-accent-ink");
    expect(within(row(/^turn_id:/)).getByText('"t3"')).toHaveClass("text-ink-body");
  });
});

describe("JsonViewer: keyboard (WAI-ARIA tree)", () => {
  it("is one tab stop, on the first row", () => {
    render(<JsonViewer label="r" value={RECORD} />);
    expect(rows().filter((item) => item.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(rows()[0]).toHaveAttribute("tabindex", "0");
  });

  it("moves between rows with Up and Down, Home and End", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} />);
    rows()[0]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(rows()[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(rows()[rows().length - 1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(rows()[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(rows()[0]).toHaveFocus();
  });

  it("opens a closed node with Right, steps into an open one, and closes with Left", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} />);
    const latency = row(/^latency_ms:/);
    latency.focus();

    await user.keyboard("{ArrowRight}");
    expect(latency).toHaveAttribute("aria-expanded", "true");
    expect(rows().some((item) => /^first_token_abs:/.test(item.textContent ?? ""))).toBe(true);

    await user.keyboard("{ArrowRight}");
    expect(row(/^first_token_abs:/)).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(row(/^latency_ms:/)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(row(/^latency_ms:/)).toHaveAttribute("aria-expanded", "false");
  });

  it("steps out to the parent with Left on a leaf", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} />);
    row(/^turn_id:/).focus();
    await user.keyboard("{ArrowLeft}");
    expect(rows()[0]).toHaveFocus();
  });

  it("toggles with Enter and with Space, and with a click", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} />);
    const latency = row(/^latency_ms:/);
    latency.focus();
    await user.keyboard("{Enter}");
    expect(latency).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(latency).toHaveAttribute("aria-expanded", "false");
    await user.click(latency);
    expect(latency).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the tab stop on the row that was last focused", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} />);
    rows()[0]?.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(rows()[2]).toHaveAttribute("tabindex", "0");
    expect(rows()[0]).toHaveAttribute("tabindex", "-1");
  });
});

describe("JsonViewer: path and copying", () => {
  it("shows the path of the focused row above the tree, and updates it", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} defaultExpandDepth={3} />);
    expect(screen.getByText("$")).toBeInTheDocument();
    row(/^first_token_abs:/).focus();
    expect(await screen.findByText("$.latency_ms.first_token_abs")).toBeInTheDocument();
    await user.keyboard("{ArrowUp}");
    expect(await screen.findByText("$.latency_ms")).toBeInTheDocument();
  });

  it("offers to copy the path and the value, and to expand or collapse everything", () => {
    render(<JsonViewer label="r" value={RECORD} />);
    expect(screen.getByRole("button", { name: "Copy path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy value" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeInTheDocument();
  });

  it("expands every collection, then collapses them all", async () => {
    const user = userEvent.setup();
    render(<JsonViewer label="r" value={RECORD} />);
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(rows().some((item) => /^chunk_id:/.test(item.textContent ?? ""))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(rows()).toHaveLength(1);
  });
});

describe("JsonViewer: 375 px (a 500-character string)", () => {
  const LONG = "wrapping ".repeat(56);

  it("wraps a long string anywhere and never sets it not to wrap", () => {
    render(<JsonViewer label="r" value={{ answer: LONG }} />);
    const value = screen.getByText(JSON.stringify(LONG));
    expect(LONG.length).toBeGreaterThan(500);
    expect(value.className).toContain("[overflow-wrap:anywhere]");
    expect(value).toHaveClass("whitespace-pre-wrap", "min-w-0");
    expect(value.className).not.toMatch(/whitespace-nowrap|truncate|overflow-x/);
  });

  it("wraps an unbroken 500-character token", () => {
    render(<JsonViewer label="r" value={{ token: "a".repeat(500) }} />);
    expect(screen.getByText(`"${"a".repeat(500)}"`).className).toContain("[overflow-wrap:anywhere]");
  });

  it("lets every row and the tree itself shrink, and has no horizontal scroll container", () => {
    const { container } = render(<JsonViewer label="r" value={{ answer: LONG }} />);
    expect(container.querySelector("[class*='overflow-x']")).toBeNull();
    expect(container.querySelector("[class*='overflow-auto']")).toBeNull();
    for (const item of rows()) expect(item).toHaveClass("min-w-0");
    expect(container.firstElementChild).toHaveClass("min-w-0");
  });

  it("caps the indent so a deep value cannot push its text off the screen", () => {
    let deep: unknown = "leaf";
    for (let level = 0; level < 20; level += 1) deep = { next: deep };
    render(<JsonViewer label="r" value={deep} defaultExpandDepth={25} />);
    const indents = rows().map((item) => Number.parseFloat(item.style.paddingInlineStart));
    expect(Math.max(...indents)).toBe(6.5);
  });

  it("puts the path in a wrapping paragraph", () => {
    const { container } = render(<JsonViewer label="r" value={{ a: 1 }} />);
    expect(container.querySelector("p")).toHaveClass("min-w-0", "break-words");
  });
});

describe("JsonViewer: large values", () => {
  it("says when it has stopped listing rows", () => {
    const big = Array.from({ length: 2500 }, (_, index) => index);
    render(<JsonViewer label="r" value={big} />);
    expect(rows()).toHaveLength(2000);
    expect(screen.getByText(/Only the first rows are listed/)).toBeInTheDocument();
  });
});

describe("CodeBlock", () => {
  it("shows the code as text with its language, wrapped, and a copy button", () => {
    const { container } = render(<CodeBlock code={'{\n  "a": 1\n}'} language="json" />);
    expect(screen.getByText("json")).toBeInTheDocument();
    expect(container.querySelector("pre")).toHaveClass("whitespace-pre-wrap", "font-mono");
    expect(container.querySelector("pre code")?.textContent).toBe('{\n  "a": 1\n}');
    expect(screen.getByRole("button", { name: "Copy json code" })).toBeInTheDocument();
  });

  it("wraps a 300-character line and never scrolls sideways", () => {
    const { container } = render(<CodeBlock code={`const value = ${"x".repeat(300)};`} language="ts" maxHeight="sm" />);
    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre).toHaveClass("whitespace-pre-wrap");
    expect(pre.className).not.toMatch(/overflow-x|whitespace-pre(?!-wrap)|nowrap/);
  });

  it("scrolls vertically, and can be focused, when it has a height limit", () => {
    render(<CodeBlock code="line" language="text" maxHeight="md" label="Answer text" />);
    const region = screen.getByRole("region", { name: "Answer text" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("overflow-y-auto", "max-h-80");
  });

  it("is not a region, and not focusable, when it grows with its code", () => {
    const { container } = render(<CodeBlock code="line" />);
    expect(container.querySelector("pre")).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("region")).toBeNull();
  });
});
