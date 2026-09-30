/**
 * The stack of floating layers: tooltips, popovers, menus, sheets.
 *
 * Three rules live here, once, so no component reimplements them:
 *
 *   1. Escape closes the top layer and nothing else. A menu inside a sheet closes
 *      first; a second Escape closes the sheet. The listener is on `window`, in the
 *      capture phase, and stops the event, so a page-level Escape handler (stop
 *      streaming, clear a filter) never fires while a layer is open.
 *   2. A modal layer makes everything behind it inert: the rest of the page, and any
 *      layer opened before it. The layers above the top modal stay usable. (`inert`
 *      removes content from the tab order and the accessibility tree.)
 *   3. While a modal layer is open the page does not scroll.
 *
 * The module has no React in it. `useLayer` in Portal.tsx is the hook that registers.
 */

export const LAYER_ROOT_ID = "layer-root";

export interface LayerOptions {
  /** A modal layer blocks everything beneath it. Popovers and tooltips are not modal. */
  modal: boolean;
  /** The layer's single root element, for the inert bookkeeping. */
  getElement: () => HTMLElement | null;
  /** Called when Escape is pressed while this layer is on top. */
  onEscape: () => void;
}

interface Entry extends LayerOptions {
  id: number;
}

const stack: Entry[] = [];
const inerted = new Set<Element>();
let nextId = 1;
let listening = false;
let lockedBy = 0;
let previousOverflow = "";

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  event.stopPropagation();
  top.onEscape();
}

function wrapperOf(entry: Entry, root: HTMLElement | null): Element | null {
  const element = entry.getElement();
  if (!element || !root) return null;
  let node: HTMLElement = element;
  while (node.parentElement && node.parentElement !== root) node = node.parentElement;
  return node.parentElement === root ? node : null;
}

/** Recomputes which parts of the page are inert. Cheap: a handful of elements. */
function syncInert(): void {
  if (typeof document === "undefined") return;
  const root = document.getElementById(LAYER_ROOT_ID);
  let topModal = -1;
  stack.forEach((entry, index) => {
    if (entry.modal) topModal = index;
  });

  const wanted = new Set<Element>();
  if (topModal >= 0) {
    for (const child of Array.from(document.body.children)) {
      if (child !== root && child.tagName !== "SCRIPT") wanted.add(child);
    }
    stack.forEach((entry, index) => {
      if (index >= topModal) return;
      const wrapper = wrapperOf(entry, root);
      if (wrapper) wanted.add(wrapper);
    });
  }

  for (const element of Array.from(inerted)) {
    if (wanted.has(element)) continue;
    element.removeAttribute("inert");
    inerted.delete(element);
  }
  for (const element of wanted) {
    if (inerted.has(element) || element.hasAttribute("inert")) continue;
    element.setAttribute("inert", "");
    inerted.add(element);
  }
}

function lockScroll(): void {
  if (typeof document === "undefined") return;
  if (lockedBy === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.setAttribute("data-scroll-locked", "");
  }
  lockedBy += 1;
}

function unlockScroll(): void {
  if (typeof document === "undefined" || lockedBy === 0) return;
  lockedBy -= 1;
  if (lockedBy === 0) {
    document.documentElement.style.overflow = previousOverflow;
    document.documentElement.removeAttribute("data-scroll-locked");
  }
}

/** Puts a layer on top of the stack. Returns the function that removes it. */
export function registerLayer(options: LayerOptions): { id: number; unregister: () => void } {
  const entry: Entry = { ...options, id: nextId };
  nextId += 1;
  stack.push(entry);

  if (!listening && typeof window !== "undefined") {
    window.addEventListener("keydown", onKeyDown, true);
    listening = true;
  }
  if (entry.modal) lockScroll();
  syncInert();

  return {
    id: entry.id,
    unregister: () => {
      const at = stack.indexOf(entry);
      if (at < 0) return;
      stack.splice(at, 1);
      if (entry.modal) unlockScroll();
      syncInert();
      if (stack.length === 0 && listening && typeof window !== "undefined") {
        window.removeEventListener("keydown", onKeyDown, true);
        listening = false;
      }
    },
  };
}

/** True when this layer is the topmost one. */
export function isTopLayer(id: number): boolean {
  return stack[stack.length - 1]?.id === id;
}

export function layerDepth(): number {
  return stack.length;
}

/** Test helper: forget every layer and undo what they did to the page. */
export function resetLayers(): void {
  stack.length = 0;
  if (lockedBy > 0) {
    lockedBy = 1;
    unlockScroll();
  }
  syncInert();
  if (listening && typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeyDown, true);
    listening = false;
  }
}
