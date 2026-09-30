import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusDot, type StatusShape } from "./StatusDot";

describe("StatusDot", () => {
  const shapes: StatusShape[] = ["ring", "filled", "diamond", "barred"];

  it.each(shapes)("draws the %s shape and names it", (shape) => {
    render(<StatusDot shape={shape} tone="ok" label={`state ${shape}`} />);
    const dot = screen.getByRole("img", { name: `state ${shape}` });
    expect(dot).toHaveAttribute("data-shape", shape);
  });

  it("gives every shape a different structure, so the meaning survives without colour", () => {
    const structures = shapes.map((shape) => {
      const { container, unmount } = render(<StatusDot shape={shape} tone="neutral" label={shape} />);
      const signature = [...container.querySelectorAll("span span")].map((part) => part.className.replace(/\b(bg|border)-[a-z-]+/g, "").trim()).join("|");
      unmount();
      return signature;
    });
    expect(new Set(structures).size).toBe(shapes.length);
  });

  it("is an 8 px mark", () => {
    render(<StatusDot shape="filled" tone="ok" label="live" />);
    expect(screen.getByRole("img", { name: "live" })).toHaveClass("size-2");
  });

  it("does not pulse, ping or glow", () => {
    for (const shape of shapes) {
      const { container, unmount } = render(<StatusDot shape={shape} tone="error" label={shape} />);
      expect(container.innerHTML).not.toMatch(/animate-|shadow-|glow/);
      unmount();
    }
  });

  it("can be decorative when it sits beside the same words: no role, hidden from assistive technology", () => {
    const { container } = render(
      <p>
        <StatusDot decorative shape="filled" tone="ok" /> Engine live
      </p>,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("[data-shape]")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the token colour for its tone, filled or outlined", () => {
    const { container: filled } = render(<StatusDot shape="filled" tone="warn" label="a" />);
    expect(filled.innerHTML).toContain("bg-warn");
    const { container: ring } = render(<StatusDot shape="ring" tone="wait" label="b" />);
    expect(ring.innerHTML).toContain("border-state-wait");
  });
});
