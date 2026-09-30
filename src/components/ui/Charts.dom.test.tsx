import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Histogram } from "./Histogram";
import { Sparkline } from "./Sparkline";
import { ThresholdMeter } from "./ThresholdMeter";

const ms = (value: number) => `${Math.round(value)}`;

/** The table alternative repeats the same text on purpose; look at what is drawn, not at the table. */
const drawn = (text: string) => {
  const found = screen.getAllByText(text).find((element) => !element.closest("table"));
  if (!found) throw new Error(`"${text}" is only in the table alternative`);
  return found;
};

describe("ThresholdMeter", () => {
  it("shows a value inside its target as a pass, with a check mark and words", () => {
    const { container } = render(<ThresholdMeter label="Time to first token" value={640} target={800} direction="atMost" unit=" ms" format={ms} />);
    expect(drawn("640 ms")).toBeInTheDocument();
    expect(drawn("Within target")).toHaveClass("text-ok-ink");
    expect(drawn("target ≤ 800 ms")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-check")).not.toBeNull();
    expect(container.querySelector("rect.fill-ok")).not.toBeNull();
  });

  it("shows a value over its target as a miss, with a cross and different words", () => {
    const { container } = render(<ThresholdMeter label="Time to first token" value={1240} target={800} direction="atMost" unit=" ms" format={ms} />);
    expect(drawn("Over target")).toHaveClass("text-error-ink");
    expect(container.querySelector("svg.lucide-x")).not.toBeNull();
    expect(container.querySelector("rect.fill-error")).not.toBeNull();
    expect(container.querySelector("svg.lucide-check")).toBeNull();
  });

  it("reads a higher-is-better target the other way round", () => {
    const { rerender } = render(<ThresholdMeter label="Citation support" value={0.92} target={0.85} direction="atLeast" />);
    expect(drawn("Meets target")).toBeInTheDocument();
    expect(drawn("target ≥ 0.85")).toBeInTheDocument();
    rerender(<ThresholdMeter label="Citation support" value={0.7} target={0.85} direction="atLeast" />);
    expect(drawn("Below target")).toBeInTheDocument();
  });

  it("treats a value equal to the target as meeting it", () => {
    render(<ThresholdMeter label="x" value={800} target={800} direction="atMost" />);
    expect(drawn("Within target")).toBeInTheDocument();
  });

  it("shows an unavailable value as a dash and a dash mark, not as zero, and draws no fill", () => {
    const { container } = render(<ThresholdMeter label="Lead" value={null} target={500} direction="atLeast" unit=" ms" />);
    expect(drawn("—")).toBeInTheDocument();
    expect(drawn("Not available")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-minus")).not.toBeNull();
    expect(container.querySelector("rect.fill-ok, rect.fill-error")).toBeNull();
  });

  it("names the bar for assistive technology with the value, the target and the verdict", () => {
    render(<ThresholdMeter label="Time to first token" value={640} target={800} direction="atMost" unit=" ms" />);
    expect(screen.getByRole("img", { name: "Time to first token: 640 ms, target ≤ 800 ms. Within target." })).toBeInTheDocument();
  });

  it("has a table alternative: the value, the target and the result", () => {
    render(<ThresholdMeter label="Time to first token" value={640} target={800} direction="atMost" unit=" ms" />);
    const table = screen.getByRole("table", { name: "Time to first token: value against target" });
    expect(table).toHaveClass("sr-only");
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["MeasureValue", "Value640 ms", "Target≤ 800 ms", "ResultWithin target"]);
  });

  it("can draw the table alternative", () => {
    render(<ThresholdMeter label="x" value={1} target={2} direction="atMost" showTable />);
    expect(screen.getByRole("table")).not.toHaveClass("sr-only");
  });

  it("keeps its numbers and labels in HTML text of 12 px or more, and puts no text in the SVG", () => {
    const { container } = render(<ThresholdMeter label="Time to first token" value={640} target={800} direction="atMost" />);
    expect(container.querySelector("svg text")).toBeNull();
    for (const element of container.querySelectorAll("figcaption, p")) {
      expect(element.className).toMatch(/text-(caption|label|body|heading)/);
      expect(element.className).not.toMatch(/text-\[/);
    }
  });

  it("stretches to the width it is given, and draws only in token colours", () => {
    const { container } = render(<ThresholdMeter label="x" value={1} target={2} direction="atMost" />);
    const svg = container.querySelector("svg.h-2") as SVGElement;
    expect(svg).toHaveAttribute("viewBox", "0 0 100 8");
    expect(svg).toHaveClass("w-full");
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|animate-/i);
  });

  it("scales the fill and the target tick to the same axis", () => {
    const { container } = render(<ThresholdMeter label="x" value={400} target={800} direction="atMost" scaleMax={1000} />);
    expect(container.querySelector("rect.fill-ok")).toHaveAttribute("width", "40");
    expect(container.querySelector("line")).toHaveAttribute("x1", "80");
  });
});

describe("Sparkline", () => {
  it("draws one polyline per unbroken run, so a gap is a gap and not a zero", () => {
    const { container } = render(<Sparkline label="TTFT by turn" values={[800, 900, null, 700, 750]} unit=" ms" format={ms} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("draws a tick for a value that stands alone", () => {
    const { container } = render(<Sparkline label="x" values={[10, null, 30]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(0);
    expect(container.querySelectorAll("line.stroke-accent-ink")).toHaveLength(2);
  });

  it("says the last, lowest and highest values in text", () => {
    render(<Sparkline label="TTFT by turn" values={[800, 1200, 640]} unit=" ms" format={ms} />);
    expect(screen.getByText("last 640 ms")).toBeInTheDocument();
    expect(screen.getByText("min 640 ms")).toBeInTheDocument();
    expect(screen.getByText("max 1200 ms")).toBeInTheDocument();
  });

  it("says there is no data, with where that leaves the number, rather than drawing a flat line", () => {
    const { container } = render(<Sparkline label="TTFT by turn" values={[null, null]} />);
    expect(screen.getByText(/No data/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("has a table alternative with one row per value, using the labels it is given", () => {
    render(<Sparkline label="TTFT by turn" values={[800, null, 640]} pointLabels={["t1", "t2", "t3"]} unit=" ms" format={ms} />);
    const table = screen.getByRole("table", { name: "TTFT by turn: values in order" });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["PointValue", "t1800 ms", "t2—", "t3640 ms"]);
  });

  it("numbers the points when it is given no labels", () => {
    render(<Sparkline label="x" values={[5, 6]} />);
    expect(within(screen.getByRole("table")).getAllByRole("row").map((row) => row.textContent)).toEqual(["PointValue", "15", "26"]);
  });

  it("is a line in a token colour with a fixed 1.5 px stroke, no fill, no markers, no motion", () => {
    const { container } = render(<Sparkline label="x" values={[1, 2, 3]} />);
    const line = container.querySelector("polyline") as SVGElement;
    expect(line).toHaveClass("stroke-accent-ink");
    expect(line).toHaveAttribute("stroke-width", "1.5");
    expect(line).toHaveAttribute("fill", "none");
    expect(line).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(container.innerHTML).not.toMatch(/animate-|<circle|gradient/);
  });

  it("stretches to the width it is given and has a fixed height", () => {
    const { container } = render(<Sparkline label="x" values={[1, 2, 3]} height={40} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg).toHaveAttribute("viewBox", "0 0 100 40");
    expect(svg).toHaveClass("w-full");
    expect((svg as unknown as HTMLElement).style.height).toBe("40px");
  });
});

describe("Histogram", () => {
  const VALUES = [100, 120, 130, 400, 410, 900];

  it("draws a bar for each bin that has values, and none for an empty bin", () => {
    const { container } = render(<Histogram label="TTFT" values={VALUES} bins={4} />);
    expect(container.querySelectorAll("rect.fill-accent-ink").length).toBe(3);
  });

  it("names the chart with how many values, what range, how many bins", () => {
    render(<Histogram label="TTFT" values={VALUES} bins={4} unit=" ms" format={ms} />);
    expect(screen.getByRole("img", { name: /TTFT: 6 values from 100 ms to 900 ms, in 4 bins/ })).toBeInTheDocument();
  });

  it("gives the range and the count in text under the bars", () => {
    render(<Histogram label="TTFT" values={VALUES} bins={4} unit=" ms" format={ms} />);
    expect(screen.getByText("100 ms")).toBeInTheDocument();
    expect(screen.getByText("900 ms")).toBeInTheDocument();
    expect(screen.getByText("n = 6")).toBeInTheDocument();
  });

  it("has a table alternative with a row per bin, and the counts add up", () => {
    render(<Histogram label="TTFT" values={VALUES} bins={4} unit=" ms" format={ms} />);
    const table = screen.getByRole("table", { name: "TTFT: count per range" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    const counts = rows.map((row) => Number(within(row).getAllByRole("cell")[1]?.textContent));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6);
  });

  it("says there is no data instead of drawing nothing", () => {
    const { container } = render(<Histogram label="TTFT" values={[]} />);
    expect(screen.getByText(/No data/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("stretches to its width, in a token colour, without motion", () => {
    const { container } = render(<Histogram label="TTFT" values={VALUES} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg).toHaveClass("w-full");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(container.innerHTML).not.toMatch(/animate-|gradient|#[0-9a-f]{3,8}\b/i);
  });

  it("draws one bar for identical values", () => {
    const { container } = render(<Histogram label="x" values={[5, 5, 5]} />);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });
});
