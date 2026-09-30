import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Kbd, platformOf } from "./Kbd";

describe("platformOf", () => {
  it.each([
    [{ platform: "MacIntel" }, "apple"],
    [{ platform: "iPhone" }, "apple"],
    [{ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)" }, "apple"],
    [{ userAgentData: { platform: "macOS" }, platform: "Win32" }, "apple"],
    [{ platform: "Win32" }, "other"],
    [{ platform: "Linux x86_64" }, "other"],
    [{}, "other"],
  ] as const)("%j is %s", (nav, expected) => {
    expect(platformOf(nav)).toBe(expected);
  });
});

describe("Kbd", () => {
  it("shows Ctrl on other platforms and reads it as Control", () => {
    render(<Kbd keys={["mod", "K"]} platform="other" />);
    const group = screen.getByRole("group", { name: "Control K" });
    expect([...group.querySelectorAll("kbd")].map((cap) => cap.textContent)).toEqual(["Ctrl", "K"]);
  });

  it("shows the command key on Apple platforms and reads it as Command", () => {
    render(<Kbd keys={["mod", "K"]} platform="apple" />);
    const group = screen.getByRole("group", { name: "Command K" });
    expect([...group.querySelectorAll("kbd")].map((cap) => cap.textContent)).toEqual(["⌘", "K"]);
  });

  it("draws each key as its own keycap, and hides the caps from assistive technology (the group carries the name)", () => {
    const { container } = render(<Kbd keys={["shift", "alt", "enter"]} platform="apple" />);
    const caps = [...container.querySelectorAll("kbd")];
    expect(caps.map((cap) => cap.textContent)).toEqual(["⇧", "⌥", "↵"]);
    for (const cap of caps) expect(cap).toHaveAttribute("aria-hidden", "true");
  });

  it("passes unknown keys through unchanged", () => {
    render(<Kbd keys={["g", "c"]} platform="other" />);
    const group = screen.getByRole("group", { name: "g c" });
    expect([...group.querySelectorAll("kbd")].map((cap) => cap.textContent)).toEqual(["g", "c"]);
  });

  it("renders the neutral (non-Apple) hint on the server, so hydration cannot mismatch", () => {
    const html = renderToString(<Kbd keys={["mod", "K"]} />);
    expect(html).toContain("Ctrl");
    expect(html).not.toContain("⌘");
  });

  it("has a chrome variant for the navy bar", () => {
    const { container } = render(<Kbd keys={["esc"]} platform="other" surface="chrome" />);
    expect(container.querySelector("kbd")).toHaveClass("text-on-chrome-muted");
  });
});
