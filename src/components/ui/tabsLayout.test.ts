import { describe, expect, it } from "vitest";
import { splitTabs } from "./tabsLayout";

describe("splitTabs", () => {
  it("shows every tab when they all fit", () => {
    expect(splitTabs({ widths: [80, 80, 80], available: 400, moreWidth: 56, selectedIndex: 0 })).toEqual({ visible: [0, 1, 2], overflow: [] });
  });

  it("shows every tab until the space has been measured", () => {
    expect(splitTabs({ widths: [80, 80, 80], available: 0, moreWidth: 56, selectedIndex: 1 })).toEqual({ visible: [0, 1, 2], overflow: [] });
  });

  it("puts what does not fit into the menu, keeping the order (six tabs at 375 px: 343 px of room)", () => {
    const widths = [72, 88, 64, 96, 80, 72];
    const split = splitTabs({ widths, available: 343, moreWidth: 56, selectedIndex: 0 });
    expect(split.visible).toEqual([0, 1, 2]);
    expect(split.overflow).toEqual([3, 4, 5]);
    const used = split.visible.reduce((sum, index) => sum + (widths[index] ?? 0), 0);
    expect(used + 56).toBeLessThanOrEqual(343);
  });

  it("keeps the selected tab visible by making room for it at the end of the visible ones", () => {
    const widths = [72, 88, 64, 96, 80, 72];
    const split = splitTabs({ widths, available: 343, moreWidth: 56, selectedIndex: 5 });
    expect(split.visible).toContain(5);
    expect(split.visible).toEqual([0, 1, 5]);
    expect([...split.visible, ...split.overflow].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("counts the gap between tabs", () => {
    const split = splitTabs({ widths: [100, 100, 100], available: 320, moreWidth: 40, selectedIndex: 0, gap: 10 });
    // 300 + 20 of gaps = 320 fits exactly.
    expect(split.overflow).toEqual([]);
    const tighter = splitTabs({ widths: [100, 100, 100], available: 319, moreWidth: 40, selectedIndex: 0, gap: 10 });
    expect(tighter.overflow.length).toBeGreaterThan(0);
  });

  it("shows the selected tab alone when nothing else fits, even if it is wider than the space", () => {
    expect(splitTabs({ widths: [500, 60], available: 300, moreWidth: 50, selectedIndex: 0 })).toEqual({ visible: [0], overflow: [1] });
  });

  it("handles no tabs", () => {
    expect(splitTabs({ widths: [], available: 300, moreWidth: 50, selectedIndex: -1 })).toEqual({ visible: [], overflow: [] });
  });

  it("holds its guarantees for 2,000 random layouts: a partition, the selected tab shown, and the shown tabs within the space", () => {
    let seed = 375;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 2000; round += 1) {
      const count = 1 + Math.floor(random() * 10);
      const widths = Array.from({ length: count }, () => 40 + Math.floor(random() * 120));
      const available = 100 + Math.floor(random() * 900);
      const moreWidth = 40 + Math.floor(random() * 30);
      const selectedIndex = Math.floor(random() * count);
      const gap = Math.floor(random() * 6);
      const { visible, overflow } = splitTabs({ widths, available, moreWidth, selectedIndex, gap });
      const label = JSON.stringify({ widths, available, moreWidth, selectedIndex, gap, visible, overflow });

      expect([...visible, ...overflow].sort((a, b) => a - b), label).toEqual(widths.map((_, index) => index));
      expect(visible, label).toContain(selectedIndex);
      expect(visible, label).toEqual([...visible].sort((a, b) => a - b));

      if (overflow.length > 0 && visible.length > 1) {
        const used = visible.reduce((sum, index) => sum + (widths[index] ?? 0), 0) + gap * (visible.length - 1);
        expect(used + gap + moreWidth, label).toBeLessThanOrEqual(available);
      }
    }
  });
});
