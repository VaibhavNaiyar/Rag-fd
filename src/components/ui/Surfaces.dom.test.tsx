import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Divider } from "./Divider";
import { EmptyState } from "./EmptyState";
import { InlineAlert } from "./InlineAlert";
import { Panel } from "./Panel";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";

describe("Panel", () => {
  it("is a landmark region named by its heading (the acceptance test)", () => {
    render(
      <Panel title="Retrieval timeline">
        <p>Body</p>
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Retrieval timeline" });
    expect(region.tagName).toBe("SECTION");
    expect(screen.getByRole("heading", { name: "Retrieval timeline", level: 2 })).toBeInTheDocument();
  });

  it("lets the heading level fit the page outline", () => {
    render(
      <Panel title="Evidence" level={3}>
        x
      </Panel>,
    );
    expect(screen.getByRole("heading", { name: "Evidence", level: 3 })).toBeInTheDocument();
  });

  it("shows a count and actions in the header", () => {
    render(
      <Panel title="Turns" count={12} actions={<button>Export</button>}>
        x
      </Panel>,
    );
    expect(screen.getByText("12")).toHaveClass("font-mono");
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("makes the body the scroll container, and lets it shrink inside a flex column", () => {
    render(
      <Panel title="Turns">
        <p>Body</p>
      </Panel>,
    );
    const body = screen.getByText("Body").parentElement as HTMLElement;
    expect(body).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByRole("region")).toHaveClass("min-h-0", "min-w-0");
  });

  it("draws a hairline border and a 4 px radius, or none when flush", () => {
    const { rerender } = render(<Panel title="A">x</Panel>);
    expect(screen.getByRole("region")).toHaveClass("border", "rounded-2");
    rerender(
      <Panel title="A" variant="flush">
        x
      </Panel>,
    );
    expect(screen.getByRole("region")).not.toHaveClass("border");
  });

  it("pads the body by 12 px unless told not to", () => {
    const { rerender } = render(<Panel title="A">Body</Panel>);
    expect(screen.getByText("Body")).toHaveClass("p-3");
    rerender(
      <Panel title="A" padded={false}>
        Body
      </Panel>,
    );
    expect(screen.getByText("Body")).not.toHaveClass("p-3");
  });
});

describe("Divider", () => {
  it("is a 1 px separator, horizontal by default", () => {
    render(<Divider />);
    const line = screen.getByRole("separator");
    expect(line).toHaveAttribute("aria-orientation", "horizontal");
    expect(line).toHaveClass("h-px", "w-full", "bg-line");
  });

  it("can be vertical and stretch to its row, or use the stronger line", () => {
    render(<Divider orientation="vertical" strong />);
    const line = screen.getByRole("separator");
    expect(line).toHaveAttribute("aria-orientation", "vertical");
    expect(line).toHaveClass("w-px", "self-stretch", "bg-line-strong");
  });
});

describe("Skeleton", () => {
  it("says Loading to assistive technology and marks the region busy", () => {
    render(<Skeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
  });

  it("draws the number of lines asked for, static, in surface grey", () => {
    const { container } = render(<Skeleton lines={4} label="Loading turns" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("Loading turns");
  });

  it("does not shimmer, pulse or animate at all (the acceptance test)", () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.innerHTML).not.toMatch(/animate-|shimmer|pulse|gradient|transition/);
  });

  it("varies the line widths so it reads as text", () => {
    const { container } = render(<Skeleton lines={3} />);
    const widths = [...container.querySelectorAll('[aria-hidden="true"]')].map((line) => [...line.classList].find((name) => name.startsWith("w-")));
    expect(new Set(widths).size).toBe(3);
  });
});

describe("Spinner", () => {
  it("is a status that says what is happening", () => {
    render(<Spinner label="Loading traces" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading traces");
  });

  it("rotates with the one allowed animation and is round: the only element, with the status dot, that may be", () => {
    const { container } = render(<Spinner />);
    const ring = container.querySelector("[aria-hidden]") as HTMLElement;
    expect(ring).toHaveClass("animate-spin", "rounded-full");
    expect(container.innerHTML).not.toMatch(/animate-(pulse|ping|bounce)/);
  });

  it("has three sizes on the 4 px grid", () => {
    const sizes = (["sm", "md", "lg"] as const).map((size) => {
      const { container, unmount } = render(<Spinner size={size} />);
      const found = [...(container.querySelector("[aria-hidden]") as HTMLElement).classList].find((name) => name.startsWith("size-"));
      unmount();
      return found;
    });
    expect(sizes).toEqual(["size-3", "size-4", "size-6"]);
  });
});

describe("EmptyState", () => {
  it("has a title, a sentence and one action, left-aligned with no illustration", () => {
    const { container } = render(
      <EmptyState title="No turns yet" action={<button>Replay a case</button>}>
        Ask a question or replay a test case.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "No turns yet", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Ask a question or replay a test case.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay a case" })).toBeInTheDocument();
    expect(container.querySelector("svg, img")).toBeNull();
    expect(container.firstElementChild).toHaveClass("items-start");
    expect(container.firstElementChild).not.toHaveClass("items-center");
  });

  it("wraps a long unbroken body", () => {
    render(<EmptyState title="x">{"y".repeat(300)}</EmptyState>);
    expect(screen.getByText("y".repeat(300))).toHaveClass("break-words");
  });
});

describe("InlineAlert", () => {
  it.each([
    ["info", "status", "Information"],
    ["ok", "status", "Success"],
    ["warn", "status", "Warning"],
    ["error", "alert", "Error"],
  ] as const)("a %s alert has role %s and says %s in words", (tone, role, word) => {
    render(<InlineAlert tone={tone}>Something happened</InlineAlert>);
    const alert = screen.getByRole(role);
    expect(alert).toHaveTextContent(`${word}: Something happened`);
  });

  it("carries the tone in an icon and in words, not only in colour (the acceptance test)", () => {
    const shapes = (["info", "ok", "warn", "error"] as const).map((tone) => {
      const { container, unmount } = render(<InlineAlert tone={tone}>x</InlineAlert>);
      const icon = container.querySelector("svg");
      const signature = icon?.getAttribute("class") ?? "";
      const paths = icon?.innerHTML ?? "";
      unmount();
      return `${signature}|${paths}`;
    });
    expect(new Set(shapes).size).toBe(4);
    render(<InlineAlert tone="error">x</InlineAlert>);
    expect(screen.getByRole("alert").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses each tone's own token colours for fill, outline and text", () => {
    render(<InlineAlert tone="warn">x</InlineAlert>);
    expect(screen.getByRole("status")).toHaveClass("bg-warn-soft", "border-warn-edge", "text-warn-ink");
  });

  it("shows a title and an action, and wraps a long unbroken message", () => {
    render(
      <InlineAlert tone="error" title="Engine unreachable" action={<button>Retry</button>}>
        {"https://engine.example/".repeat(20)}
      </InlineAlert>,
    );
    expect(screen.getByText("Engine unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("alert").querySelector(".break-words")).not.toBeNull();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <InlineAlert tone="info" onDismiss={onDismiss}>
        x
      </InlineAlert>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has no dismiss button unless it can be dismissed", () => {
    render(<InlineAlert>x</InlineAlert>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
