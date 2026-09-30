import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabPanel, Tabs, type TabItem } from "./Tabs";

const ITEMS: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline", count: 4 },
  { id: "evidence", label: "Evidence" },
  { id: "raw", label: "Raw record", disabled: true },
  { id: "diff", label: "Answer diff" },
];

function Harness({ initial = "overview", items = ITEMS, onChange = () => undefined }: { initial?: string; items?: TabItem[]; onChange?: (id: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Tabs
        label="Inspector sections"
        items={items}
        value={value}
        idPrefix="t"
        onValueChange={(id) => {
          setValue(id);
          onChange(id);
        }}
      />
      {items.map((item) => (
        <TabPanel key={item.id} idPrefix="t" tabId={item.id} active={item.id === value}>
          <p>Content of {item.label}</p>
        </TabPanel>
      ))}
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Tabs: semantics", () => {
  it("is a named tab list of tabs, exactly one selected", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist", { name: "Inspector sections" });
    const tabs = screen.getAllByRole("tab");
    expect(list).toBeInTheDocument();
    expect(tabs).toHaveLength(ITEMS.length);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("has one tab stop: only the selected tab is in the tab order", () => {
    render(<Harness />);
    const stops = screen.getAllByRole("tab").filter((tab) => tab.getAttribute("tabindex") === "0");
    expect(stops.map((tab) => tab.textContent)).toEqual(["Overview"]);
  });

  it("ties each tab to its panel with aria-controls and aria-labelledby", () => {
    render(<Harness />);
    const tab = screen.getByRole("tab", { name: "Overview" });
    const panel = screen.getByRole("tabpanel", { name: "Overview" });
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("shows only the active panel's content, and hides the others", () => {
    render(<Harness />);
    expect(screen.getByText("Content of Overview")).toBeInTheDocument();
    expect(screen.queryByText("Content of Timeline")).toBeNull();
  });

  it("puts a count after the label, in the monospace face", () => {
    render(<Harness />);
    const tab = screen.getByRole("tab", { name: /Timeline/ });
    expect(tab).toHaveTextContent("Timeline4");
    expect(tab.querySelector(".font-mono")?.textContent).toBe("4");
  });
});

describe("Tabs: keyboard", () => {
  it("moves selection and focus with the arrow keys, wrapping at both ends, skipping disabled tabs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole("tab", { name: "Overview" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Timeline/ })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /Timeline/ })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}{ArrowRight}");
    // Evidence, then past the disabled "Raw record" to "Answer diff".
    expect(screen.getByRole("tab", { name: "Answer diff" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Answer diff" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("diff");
  });

  it("goes to the first and last tab with Home and End", async () => {
    const user = userEvent.setup();
    render(<Harness initial="evidence" />);
    screen.getByRole("tab", { name: "Evidence" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Answer diff" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("selects on click, and shows that tab's panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(screen.getByText("Content of Evidence")).toBeInTheDocument();
    expect(screen.queryByText("Content of Overview")).toBeNull();
  });

  it("leaves a disabled tab unselectable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "Raw record" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Tab moves out of the list to the panel, not to the next tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.tab();
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toHaveFocus();
  });
});

describe("Tabs: variants", () => {
  it("marks the selected underline tab with a 2 px selection bar", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Overview" }).className).toContain("after:h-0.5");
  });

  it("draws the segmented variant as a bordered group with a filled selected segment", () => {
    render(<Tabs label="Lens" variant="segmented" items={ITEMS} value="overview" onValueChange={() => undefined} />);
    expect(screen.getByRole("tablist").className).toContain("border-line-control");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveClass("bg-accent-soft");
  });
});

/**
 * jsdom does no layout, so the overflow behaviour is driven by hand: a ResizeObserver
 * that fires on demand, and fixed sizes for the container and for the hidden measuring
 * copy. The arithmetic itself is covered, exhaustively, by tabsLayout.test.ts.
 */
describe("Tabs: overflow into a More menu (no horizontal scroll)", () => {
  function overflowed(containerWidth: number) {
    const observers: { callback: ResizeObserverCallback }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback });
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const width = this.hasAttribute("data-measure-tab") ? 100 : this.hasAttribute("data-measure-more") ? 50 : 0;
      return { width, height: 36, top: 0, left: 0, right: width, bottom: 36, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.querySelector('[role="tablist"]') && !this.getAttribute("role") ? containerWidth : 0;
    });
    return () => act(() => observers.forEach(({ callback }) => callback([], {} as ResizeObserver)));
  }

  const SIX: TabItem[] = ["One", "Two", "Three", "Four", "Five", "Six"].map((label) => ({ id: label.toLowerCase(), label }));

  it("shows the tabs that fit, and the rest in a More menu, at a 343 px container (six tabs at 375 px)", async () => {
    const measure = overflowed(343);
    render(<Harness initial="one" items={SIX} />);
    measure();

    // 343 - 50 (More) = 293 fits two 100 px tabs.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["One", "Two"]);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-haspopup", "menu");

    const user = userEvent.setup();
    await user.click(more);
    const menu = screen.getByRole("menu", { name: "More tabs" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Three", "Four", "Five", "Six"]);
    expect(menu).toBeInTheDocument();
  });

  it("choosing a tab from the menu selects it, and it moves into view", async () => {
    const measure = overflowed(343);
    const onChange = vi.fn();
    render(<Harness initial="one" items={SIX} onChange={onChange} />);
    measure();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Five" }));
    measure();

    expect(onChange).toHaveBeenCalledWith("five");
    expect(screen.getByRole("tab", { name: "Five" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Content of Five")).toBeInTheDocument();
  });

  it("shows no More button when everything fits", () => {
    const measure = overflowed(1000);
    render(<Harness initial="one" items={SIX} />);
    measure();
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("keeps its measuring copy out of the accessibility tree and the tab order", () => {
    const measure = overflowed(343);
    const { container } = render(<Harness initial="one" items={SIX} />);
    measure();
    const copy = container.querySelector("[data-measure-tab]")?.closest("[aria-hidden]");
    expect(copy).toHaveAttribute("aria-hidden", "true");
    expect(copy).toHaveAttribute("inert");
  });
});
