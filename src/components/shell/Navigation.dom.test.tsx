import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NavRail } from "./NavRail";
import { TabBar } from "./TabBar";

describe("NavRail", () => {
  it("is the views navigation, three links to their routes, named by their labels", () => {
    render(<NavRail active="console" />);
    const nav = screen.getByRole("navigation", { name: "Views" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual(["Console", "Traces", "Metrics"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#/console", "#/traces", "#/metrics"]);
  });

  it("marks the current view with aria-current, and only that one", () => {
    render(<NavRail active="traces" />);
    expect(screen.getByRole("link", { name: "Traces" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Console" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Metrics" })).not.toHaveAttribute("aria-current");
  });

  it("marks it with a bar and a fill as well as a colour", () => {
    render(<NavRail active="metrics" />);
    const current = screen.getByRole("link", { name: "Metrics" });
    expect(current.className).toContain("before:w-0.5");
    expect(current).toHaveClass("bg-chrome-hover");
  });

  it("is one tab stop, on the current view (the acceptance test)", () => {
    render(<NavRail active="traces" />);
    const links = screen.getAllByRole("link");
    expect(links.filter((link) => link.getAttribute("tabindex") === "0").map((link) => link.getAttribute("aria-label"))).toEqual(["Traces"]);
  });

  it("moves between the views with Up and Down, wrapping, and to the ends with Home and End", async () => {
    const user = userEvent.setup();
    render(<NavRail active="console" />);
    screen.getByRole("link", { name: "Console" }).focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Traces" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("link", { name: "Console" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("link", { name: "Metrics" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("link", { name: "Console" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("link", { name: "Metrics" })).toHaveFocus();
  });

  it("shows the label in a tooltip on keyboard focus, without describing the link with its own name", async () => {
    const user = userEvent.setup();
    render(<NavRail active="console" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Console");
    expect(screen.getByRole("link", { name: "Console" })).not.toHaveAttribute("aria-describedby");
  });

  it("hides its icons from assistive technology", () => {
    const { container } = render(<NavRail active="console" />);
    for (const icon of container.querySelectorAll("svg")) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("is 56 px wide by its tokens, on the navy chrome, and only from 768 px", () => {
    render(<NavRail active="console" />);
    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(nav).toHaveClass("frame-nav", "hidden", "md:flex", "bg-chrome", "pl-safe-left");
    expect(nav).toHaveAttribute("data-surface", "chrome");
    expect(within(nav).getAllByRole("link")[0]).toHaveClass("size-hit");
  });
});

describe("TabBar", () => {
  it("is the views navigation, three links with an icon and a visible name", () => {
    render(<TabBar active="console" />);
    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Console", "Traces", "Metrics"]);
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#/console", "#/traces", "#/metrics"]);
  });

  it("marks the current view with aria-current, a bar and a colour", () => {
    render(<TabBar active="traces" />);
    const current = screen.getByRole("link", { name: "Traces" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain("before:h-0.5");
    expect(current).toHaveClass("text-accent-ink");
    expect(screen.getByRole("link", { name: "Console" })).not.toHaveAttribute("aria-current");
  });

  it("makes every tab the full height of the bar and never less than 44 px (the touch-target test)", () => {
    render(<TabBar active="console" />);
    for (const link of screen.getAllByRole("link")) expect(link).toHaveClass("h-full", "min-h-hit");
    expect(screen.getByRole("list")).toHaveClass("h-tabbar");
  });

  it("pads by the home indicator and the notch, and only shows below 768 px", () => {
    render(<TabBar active="console" />);
    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(nav).toHaveClass("pb-safe-bottom", "pl-safe-left", "pr-safe-right", "md:hidden");
  });

  it("gives each tab a third of the width and lets its label shrink", () => {
    render(<TabBar active="console" />);
    for (const item of screen.getAllByRole("listitem")) expect(item).toHaveClass("flex-1", "min-w-0");
  });
});
