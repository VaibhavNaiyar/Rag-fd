import { describe, expect, it } from "vitest";
import { computePosition, type Rect, type Size } from "./position";

const PHONE: Size = { width: 375, height: 667 };
const anchorAt = (left: number, top: number, width = 32, height = 32): Rect => ({ left, top, width, height });

describe("computePosition", () => {
  it("opens below the anchor, aligned to its start edge", () => {
    const place = computePosition({ anchor: anchorAt(100, 100), floating: { width: 160, height: 120 }, viewport: PHONE });
    expect(place).toMatchObject({ side: "bottom", left: 100, top: 136 });
  });

  it("aligns to the end or the centre of the anchor", () => {
    const anchor = anchorAt(200, 100, 40, 32);
    const floating = { width: 100, height: 50 };
    expect(computePosition({ anchor, floating, viewport: PHONE, align: "end" }).left).toBe(140);
    expect(computePosition({ anchor, floating, viewport: PHONE, align: "center" }).left).toBe(170);
  });

  it("flips above when there is no room below and more room above", () => {
    const place = computePosition({ anchor: anchorAt(100, 600), floating: { width: 160, height: 200 }, viewport: PHONE });
    expect(place.side).toBe("top");
    expect(place.top + 200).toBeLessThanOrEqual(600 - 4);
  });

  it("stays below when neither side fits but below has more room, and caps the height so it scrolls", () => {
    const place = computePosition({ anchor: anchorAt(100, 250), floating: { width: 160, height: 900 }, viewport: PHONE });
    expect(place.side).toBe("bottom");
    expect(place.maxHeight).toBeLessThanOrEqual(PHONE.height - 250 - 32 - 4 - 8);
  });

  it("keeps a layer that overhangs the right edge inside the viewport at 375 px", () => {
    const place = computePosition({ anchor: anchorAt(340, 20), floating: { width: 320, height: 200 }, viewport: PHONE, align: "start" });
    expect(place.left).toBeGreaterThanOrEqual(8);
    expect(place.left + 320).toBeLessThanOrEqual(PHONE.width - 8);
  });

  it("gives a layer wider than the viewport a width limit and puts it at the margin", () => {
    const place = computePosition({ anchor: anchorAt(10, 10), floating: { width: 900, height: 40 }, viewport: PHONE });
    expect(place.maxWidth).toBe(PHONE.width - 16);
    expect(place.left).toBe(8);
  });

  it("places beside the anchor on the left or right and flips when the side is full", () => {
    const right = computePosition({ anchor: anchorAt(40, 300), floating: { width: 120, height: 60 }, viewport: PHONE, side: "right" });
    expect(right.side).toBe("right");
    expect(right.left).toBe(76);
    const flipped = computePosition({ anchor: anchorAt(300, 300), floating: { width: 120, height: 60 }, viewport: PHONE, side: "right" });
    expect(flipped.side).toBe("left");
    expect(flipped.left).toBeGreaterThanOrEqual(8);
  });

  it("never reports a negative limit, even when the anchor fills the viewport", () => {
    const place = computePosition({ anchor: { left: 0, top: 0, width: 375, height: 667 }, floating: { width: 200, height: 200 }, viewport: PHONE });
    expect(place.maxWidth).toBeGreaterThan(0);
    expect(place.maxHeight).toBeGreaterThan(0);
  });

  it("keeps every layer inside the viewport, for any anchor, size and preference (2,000 random cases)", () => {
    // A small deterministic generator, so a failure reproduces.
    let seed = 20260926;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const between = (low: number, high: number) => low + random() * (high - low);
    const sides = ["top", "bottom", "left", "right"] as const;
    const aligns = ["start", "center", "end"] as const;

    for (let index = 0; index < 2000; index += 1) {
      const viewport = { width: Math.round(between(375, 1920)), height: Math.round(between(500, 1200)) };
      const anchor = anchorAt(between(0, viewport.width - 8), between(0, viewport.height - 8), between(8, 240), between(8, 60));
      const floating = { width: between(20, 1200), height: between(20, 1400) };
      const margin = 8;
      const place = computePosition({
        anchor,
        floating,
        viewport,
        side: sides[Math.floor(random() * 4)],
        align: aligns[Math.floor(random() * 3)],
        margin,
      });

      const width = Math.min(floating.width, place.maxWidth);
      const height = Math.min(floating.height, place.maxHeight);
      const label = `case ${index}: ${JSON.stringify({ viewport, anchor, floating, place })}`;
      expect(place.left, label).toBeGreaterThanOrEqual(margin - 1e-6);
      expect(place.top, label).toBeGreaterThanOrEqual(margin - 1e-6);
      expect(place.left + width, label).toBeLessThanOrEqual(viewport.width - margin + 1e-6);
      expect(place.top + height, label).toBeLessThanOrEqual(viewport.height - margin + 1e-6);
      expect(place.maxWidth, label).toBeLessThanOrEqual(viewport.width - 2 * margin + 1e-6);
    }
  });
});
