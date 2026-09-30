/**
 * Which tabs fit in the space, and which go into the "More" menu.
 *
 * Pure arithmetic over measured widths, so the rule that matters is tested without a
 * browser: however narrow the space, the selected tab stays visible, and the tabs
 * that are shown never add up to more than the space (less the "More" button).
 */

export interface SplitInput {
  /** Each tab's natural width in px, in order. */
  widths: readonly number[];
  /** The width the tabs may use. Zero or less means "not measured yet": everything is shown. */
  available: number;
  /** The width of the "More" button. */
  moreWidth: number;
  /** The selected tab's index, or -1. It is always kept visible. */
  selectedIndex: number;
  /** Space between tabs. Default 0. */
  gap?: number;
}

export interface Split {
  /** Indices of the tabs to draw, in their original order. */
  visible: number[];
  /** Indices of the tabs that go into the menu, in their original order. */
  overflow: number[];
}

export function splitTabs({ widths, available, moreWidth, selectedIndex, gap = 0 }: SplitInput): Split {
  const count = widths.length;
  const all = Array.from({ length: count }, (_, index) => index);
  if (count === 0 || !(available > 0)) return { visible: all, overflow: [] };

  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (count - 1);
  if (total <= available) return { visible: all, overflow: [] };

  const budget = available - moreWidth - gap;
  const visible: number[] = [];
  let used = 0;
  for (const index of all) {
    const next = used + (visible.length > 0 ? gap : 0) + (widths[index] ?? 0);
    if (next > budget) break;
    visible.push(index);
    used = next;
  }

  if (selectedIndex >= 0 && selectedIndex < count && !visible.includes(selectedIndex)) {
    const need = widths[selectedIndex] ?? 0;
    // Drop tabs from the end until the selected one fits.
    while (visible.length > 0 && used + gap + need > budget) {
      const dropped = visible.pop();
      used -= (widths[dropped ?? 0] ?? 0) + (visible.length > 0 ? gap : 0);
    }
    visible.push(selectedIndex);
  }

  visible.sort((a, b) => a - b);
  return { visible, overflow: all.filter((index) => !visible.includes(index)) };
}
