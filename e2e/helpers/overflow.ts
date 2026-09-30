import type { Page } from "@playwright/test";
import type { Defect } from "./app";

export interface Overflow extends Defect {
  kind: string;
  element: string;
  scrollWidth: number;
  clientWidth: number;
  right?: number;
}

/**
 * Every way a horizontal scrollbar can appear (PHASES.md R4):
 *   - the page itself scrolls sideways;
 *   - a region the reader can scroll (overflow auto or scroll) holds content wider than itself;
 *   - an element that no ancestor clips extends past the right edge of the viewport.
 * There is no allow-list. Left-hand overflow is not counted, because it cannot scroll,
 * and neither are fixed elements, which never widen the page.
 */
export async function findOverflow(page: Page): Promise<Overflow[]> {
  return page.evaluate<Overflow[]>(() => {
    const found: Overflow[] = [];
    const root = document.documentElement;
    const viewport = root.clientWidth;

    const describe = (element: Element): string => {
      const id = element.id ? `#${element.id}` : "";
      const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join("");
      const label = element.getAttribute("aria-label");
      return `${element.tagName.toLowerCase()}${id}${classes}${label ? `[aria-label="${label}"]` : ""}`;
    };
    const clippedByAncestor = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX !== "visible") return true;
      }
      return false;
    };

    if (root.scrollWidth > root.clientWidth) {
      found.push({ kind: "the page scrolls sideways", element: "html", scrollWidth: root.scrollWidth, clientWidth: root.clientWidth });
    }
    for (const element of document.body.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") continue;
      const scrollable = style.overflowX === "auto" || style.overflowX === "scroll";
      if (scrollable && element.scrollWidth > element.clientWidth + 1) {
        found.push({ kind: "a scrollable region holds wider content", element: describe(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth });
      } else if (!clippedByAncestor(element)) {
        const box = element.getBoundingClientRect();
        if (box.width > 0 && box.right > viewport + 1) {
          found.push({
            kind: "extends past the right edge",
            element: describe(element),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            right: Math.round(box.right),
          });
        }
      }
    }
    return found.slice(0, 40);
  });
}
