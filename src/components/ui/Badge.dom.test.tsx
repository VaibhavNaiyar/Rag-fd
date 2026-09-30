import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge, type BadgeTone } from "./Badge";
import { DecisionPill } from "./DecisionPill";
import { Pill } from "./Pill";

/** jsdom has no PointerEvent; build the hover by hand (see Tooltip.dom.test.tsx). */
function hover(target: Element) {
  const event = new Event("pointerover", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  act(() => void target.dispatchEvent(event));
}

const SIXTY = "A label that is deliberately sixty characters long, no fewer";

describe("Badge", () => {
  it("is 20 px tall at least, radius 4, text 12: the design's measures", () => {
    render(<Badge>ok</Badge>);
    const badge = screen.getByText("ok").parentElement as HTMLElement;
    expect(badge).toHaveClass("min-h-5", "rounded-2", "text-caption");
  });

  describe("375 px, 60-character label (the acceptance case)", () => {
    // jsdom does no layout, so this asserts the classes that make the browser keep the
    // badge inside its row; kit.spec.ts measures the real thing at 375 px in Chromium.
    it("truncates by default: it can shrink, is capped at its row, and clips with an ellipsis", () => {
      render(<Badge>{SIXTY}</Badge>);
      const badge = screen.getByText(SIXTY).parentElement as HTMLElement;
      expect(badge).toHaveClass("max-w-full", "min-w-0");
      expect(screen.getByText(SIXTY)).toHaveClass("truncate", "min-w-0");
      expect(badge.className).not.toContain("whitespace-nowrap");
    });

    it("wraps in wrap mode instead of clipping", () => {
      render(<Badge wrap>{SIXTY}</Badge>);
      const text = screen.getByText(SIXTY);
      expect(text).toHaveClass("break-words");
      expect(text).not.toHaveClass("truncate");
    });
  });

  it("marks tones with fill, outline and text together", () => {
    const tones: [BadgeTone, string][] = [
      ["neutral", "bg-surface-2"],
      ["accent", "bg-accent-soft"],
      ["ok", "bg-ok-soft"],
      ["warn", "bg-warn-soft"],
      ["error", "bg-error-soft"],
    ];
    for (const [tone, fill] of tones) {
      const { unmount } = render(<Badge tone={tone}>{tone}</Badge>);
      expect(screen.getByText(tone).parentElement).toHaveClass(fill);
      unmount();
    }
  });

  it("draws the optional glyph before the text and hides it from assistive technology", () => {
    render(<Badge glyph={<svg data-testid="glyph" />}>Ready</Badge>);
    expect(screen.getByTestId("glyph").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the monospace face for ids and counts", () => {
    render(<Badge mono>t3_v1_c2</Badge>);
    expect(screen.getByText("t3_v1_c2").parentElement).toHaveClass("font-mono");
  });

  it("explains itself with a tooltip on hover, wired with aria-describedby", () => {
    vi.useFakeTimers();
    render(<Badge tooltip="A per-sub-query quota was applied">quota</Badge>);
    const badge = screen.getByText("quota").parentElement as HTMLElement;
    hover(badge);
    act(() => void vi.advanceTimersByTime(600));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("A per-sub-query quota was applied");
    expect(badge).toHaveAttribute("aria-describedby", tip.id);
  });

  it("has no tooltip when it has nothing to add", () => {
    vi.useFakeTimers();
    render(<Badge>plain</Badge>);
    hover(screen.getByText("plain").parentElement as HTMLElement);
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("Pill (the old name of Badge)", () => {
  it("keeps its tones, mapped onto the new ones, and its title becomes a tooltip", () => {
    vi.useFakeTimers();
    render(
      <Pill tone="primary" title="Why this matters">
        quota
      </Pill>,
    );
    const pill = screen.getByText("quota").parentElement as HTMLElement;
    expect(pill).toHaveClass("bg-accent-soft");
    expect(pill).not.toHaveAttribute("title");
    hover(pill);
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Why this matters");
  });
});

describe("DecisionPill", () => {
  it.each([
    ["wait", "ring", "Wait"],
    ["retrieve", "filled", "Retrieve"],
    ["refine", "diamond", "Refine"],
    ["suppress", "barred", "Suppress"],
  ] as const)("shows %s as a %s mark and the word %s", (decision, shape, word) => {
    const { container } = render(<DecisionPill decision={decision} />);
    expect(container).toHaveTextContent(word);
    expect(container.querySelector(`[data-shape="${shape}"]`)).not.toBeNull();
  });

  it("adds the reason in words and the confidence as a number", () => {
    const { container } = render(<DecisionPill decision="retrieve" reason="multi_intent_detected" confidence={0.8} />);
    expect(container).toHaveTextContent("multi-intent detected");
    expect(container).toHaveTextContent("0.80");
  });

  it("wraps a long reason rather than clipping it", () => {
    render(<DecisionPill decision="suppress" reason="presentation_only" />);
    expect(screen.getByText(/Suppress/)).toHaveClass("break-words");
  });
});
