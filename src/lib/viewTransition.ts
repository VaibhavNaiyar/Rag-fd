import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

/**
 * Run a state change inside a View Transition so the browser animates the
 * difference — the centred-to-docked composer move is the only place we need it.
 *
 * `flushSync` is required: the transition snapshots the DOM synchronously, so a
 * React 18+ batched update would land after the snapshot and animate nothing.
 * Browsers without the API just get the instant change.
 */
export function withViewTransition(update: () => void): void {
  if (typeof document === "undefined") {
    update();
    return;
  }

  const doc = document as ViewTransitionDocument;
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!doc.startViewTransition || reduced) {
    update();
    return;
  }

  doc.startViewTransition(() => {
    flushSync(update);
  });
}
