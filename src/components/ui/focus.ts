/**
 * Focus helpers shared by the sheet, the popover and the menu.
 *
 * Nothing here measures layout, so it behaves the same in a browser and in jsdom.
 */

const FOCUSABLE = ["a[href]", "button", "input:not([type='hidden'])", "select", "textarea", "summary", "[tabindex]", "[contenteditable='true']"].join(",");

/** True when the element can be reached with the Tab key right now. */
export function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  if (element.matches(":disabled")) return false;
  if (element.closest("[inert], [hidden]")) return false;
  if (typeof element.checkVisibility === "function" && !element.checkVisibility()) return false;
  return true;
}

/** Everything inside `container` that Tab can reach, in document order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabbable);
}

/**
 * Keeps Tab and Shift+Tab inside `container`. Call it from a keydown handler.
 * The container should have tabIndex -1 so it can hold focus when it has nothing
 * focusable inside. Events from outside the container (a portaled popover that
 * React bubbles through) are left alone.
 */
export function trapTab(event: { key: string; shiftKey: boolean; target: EventTarget | null; preventDefault: () => void }, container: HTMLElement): void {
  if (event.key !== "Tab") return;
  if (!(event.target instanceof Node) || !container.contains(event.target)) return;

  const items = focusableWithin(container);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    container.focus();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Focuses `preferred` if it is in the container, else the first tabbable element, else the container itself. */
export function focusInside(container: HTMLElement, preferred?: HTMLElement | null): void {
  if (preferred && container.contains(preferred)) {
    preferred.focus({ preventScroll: true });
    return;
  }
  const first = focusableWithin(container)[0];
  (first ?? container).focus({ preventScroll: true });
}

/**
 * Remembers what has focus now and returns a function that gives it back. The
 * function takes an optional test of what has focus at that moment, so a layer that
 * closes because the reader clicked into some other field does not pull focus away
 * from it. When the element has gone (or is behind something inert) it does nothing.
 */
export function captureFocus(): (when?: (active: Element | null) => boolean) => void {
  const previous = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  return (when) => {
    if (when && !when(document.activeElement)) return;
    if (previous && previous.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true });
  };
}
