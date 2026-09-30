import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { setMedia } from "@/test/setup";
import { useAtLeast, useBreakpoint } from "./useBreakpoint";

function Probe() {
  const viewport = useBreakpoint();
  const docked = useAtLeast("lg");
  return (
    <p>
      {viewport} {docked ? "docked" : "sheet"}
    </p>
  );
}

const MIN = (px: number) => `(min-width: ${px}px)`;
const UP_TO_MD = { [MIN(480)]: true, [MIN(768)]: true };
const UP_TO_LG = { ...UP_TO_MD, [MIN(1024)]: true };

describe("useBreakpoint", () => {
  it("is xs when no query matches", () => {
    render(<Probe />);
    expect(screen.getByText("xs sheet")).toBeInTheDocument();
  });

  it.each([
    [{ [MIN(480)]: true }, "sm"],
    [UP_TO_MD, "md"],
    [UP_TO_LG, "lg"],
    [{ ...UP_TO_LG, [MIN(1280)]: true }, "xl"],
    [{ ...UP_TO_LG, [MIN(1280)]: true, [MIN(1536)]: true }, "2xl"],
  ] as const)("is the largest step that matches: %s", (queries, expected) => {
    setMedia({ ...queries });
    render(<Probe />);
    expect(screen.getByText(new RegExp(`^${expected} `))).toBeInTheDocument();
  });

  it("follows the window as it is resized", () => {
    render(<Probe />);
    expect(screen.getByText("xs sheet")).toBeInTheDocument();
    act(() => setMedia(UP_TO_MD));
    expect(screen.getByText("md sheet")).toBeInTheDocument();
    act(() => setMedia(UP_TO_LG));
    expect(screen.getByText("lg docked")).toBeInTheDocument();
    act(() => setMedia({}));
    expect(screen.getByText("xs sheet")).toBeInTheDocument();
  });

  it("uses the same media queries as the CSS: min-width at each step of the scale", () => {
    const seen: string[] = [];
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      seen.push(query);
      return original(query);
    }) as typeof window.matchMedia;
    try {
      render(<Probe />);
    } finally {
      window.matchMedia = original;
    }
    expect([...new Set(seen)].sort()).toEqual([MIN(1024), MIN(1280), MIN(1536), MIN(480), MIN(768)].sort());
  });

  it("stops listening when it unmounts: every listener it added is removed", () => {
    let added = 0;
    let removed = 0;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      const list = original(query);
      const addOriginal = list.addEventListener.bind(list);
      const removeOriginal = list.removeEventListener.bind(list);
      return Object.assign(list, {
        addEventListener: (...args: Parameters<typeof addOriginal>) => {
          added += 1;
          addOriginal(...args);
        },
        removeEventListener: (...args: Parameters<typeof removeOriginal>) => {
          removed += 1;
          removeOriginal(...args);
        },
      });
    }) as typeof window.matchMedia;
    try {
      const { unmount } = render(<Probe />);
      expect(added).toBeGreaterThan(0);
      unmount();
    } finally {
      window.matchMedia = original;
    }
    expect(removed).toBe(added);
  });
});

describe("hydration (the acceptance test: no mismatch)", () => {
  it("renders xs on the server, and a wide client hydrates it without a warning, then corrects itself", async () => {
    const markup = renderToString(<Probe />);
    expect(markup).toContain("xs");
    expect(markup).toContain("sheet");

    setMedia(UP_TO_LG);
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Probe />);
    });

    expect(errors).not.toHaveBeenCalled();
    expect(container.textContent).toContain("lg docked");
    act(() => root?.unmount());
    container.remove();
    errors.mockRestore();
  });
});
