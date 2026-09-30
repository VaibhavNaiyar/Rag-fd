import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { resetLayers } from "@/components/ui/layerStack";

/*
 * Setup for the `dom` project (jsdom). jsdom implements the DOM but not the
 * browser's layout and media machinery, so the pieces components lean on are
 * stubbed here, and each test starts from a clean page.
 */

afterEach(() => {
  cleanup();
  resetLayers();
  document.documentElement.style.overflow = "";
  vi.useRealTimers();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  setMedia({});
});

// ---------------------------------------------------------------- matchMedia

type MediaListener = (event: MediaQueryListEvent) => void;

const MEDIA_KEY = "__slrTestMedia";
interface MediaStore {
  matches: Record<string, boolean>;
  listeners: Map<string, Set<MediaListener>>;
}

const store = ((globalThis as Record<string, unknown>)[MEDIA_KEY] ??= { matches: {}, listeners: new Map() }) as MediaStore;

/**
 * Decides what window.matchMedia reports, and tells listeners about every change:
 * `setMedia({ "(prefers-color-scheme: dark)": true })`. Queries not listed do not match.
 */
export function setMedia(next: Record<string, boolean>): void {
  const before = store.matches;
  store.matches = { ...next };
  for (const query of new Set([...Object.keys(before), ...Object.keys(next)])) {
    const was = before[query] ?? false;
    const now = next[query] ?? false;
    if (was === now) continue;
    for (const listener of store.listeners.get(query) ?? []) listener({ matches: now, media: query } as MediaQueryListEvent);
  }
}

function matchMedia(query: string): MediaQueryList {
  return {
    media: query,
    get matches() {
      return store.matches[query] ?? false;
    },
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      const set = store.listeners.get(query) ?? new Set<MediaListener>();
      set.add(listener as MediaListener);
      store.listeners.set(query, set);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      store.listeners.get(query)?.delete(listener as MediaListener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}


// ---------------------------------------------------------------- layout observers

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();

/**
 * Puts the browser globals jsdom lacks in place. It runs at import and before every test,
 * because a test that calls vi.unstubAllGlobals() to undo its own stubs would otherwise
 * take these away too, and the next test would find no matchMedia.
 */
function installGlobals(): void {
  vi.stubGlobal("matchMedia", matchMedia);
  window.matchMedia = matchMedia;
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
}

installGlobals();
beforeEach(installGlobals);

// ---------------------------------------------------------------- timers

/** Runs `run` under fake timers and always restores real ones: `await withFakeTimers(async () => { … vi.advanceTimersByTime(500) })`. */
export async function withFakeTimers<T>(run: () => Promise<T> | T): Promise<T> {
  vi.useFakeTimers();
  try {
    return await run();
  } finally {
    vi.useRealTimers();
  }
}

// ---------------------------------------------------------------- DOM matchers

/*
 * The handful of DOM assertions the component tests read best with, written here
 * rather than adding a package for them. Each mirrors the matcher of the same name
 * in jest-dom, so a reader who knows that library knows these.
 */

interface DomMatchers<R = unknown> {
  toBeInTheDocument(): R;
  toHaveAttribute(name: string, value?: string | RegExp): R;
  toHaveClass(...names: string[]): R;
  toHaveFocus(): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toHaveTextContent(text: string | RegExp): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends DomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends DomMatchers {}
}

const element = (received: unknown): Element => {
  if (!(received instanceof Element)) throw new TypeError("expected a DOM element");
  return received;
};

expect.extend({
  toBeInTheDocument(received: unknown) {
    const pass = received instanceof Node && received.ownerDocument !== null && received.ownerDocument.contains(received);
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to be in the document` };
  },

  toHaveAttribute(received: unknown, name: string, value?: string | RegExp) {
    const target = element(received);
    const actual = target.getAttribute(name);
    const pass = value === undefined ? actual !== null : actual !== null && (value instanceof RegExp ? value.test(actual) : actual === value);
    return { pass, message: () => `expected <${target.tagName.toLowerCase()}> ${pass ? "not " : ""}to have attribute ${name}${value === undefined ? "" : `=${String(value)}`}, it has ${actual === null ? "none" : JSON.stringify(actual)}` };
  },

  toHaveClass(received: unknown, ...names: string[]) {
    const target = element(received);
    const wanted = names.flatMap((name) => name.split(/\s+/)).filter(Boolean);
    const missing = wanted.filter((name) => !target.classList.contains(name));
    const pass = missing.length === 0;
    return { pass, message: () => `expected class "${target.getAttribute("class") ?? ""}" ${pass ? "not " : ""}to contain ${wanted.join(" ")}${pass ? "" : ` (missing ${missing.join(" ")})`}` };
  },

  toHaveFocus(received: unknown) {
    const target = element(received);
    const pass = target.ownerDocument.activeElement === target;
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to have focus` };
  },

  toBeDisabled(received: unknown) {
    const target = element(received);
    const pass = target.matches(":disabled");
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to be disabled` };
  },

  toBeEnabled(received: unknown) {
    const target = element(received);
    const pass = !target.matches(":disabled");
    return { pass, message: () => `expected the element ${pass ? "not " : ""}to be enabled` };
  },

  toHaveTextContent(received: unknown, text: string | RegExp) {
    const target = element(received);
    const actual = (target.textContent ?? "").replace(/\s+/g, " ").trim();
    const pass = text instanceof RegExp ? text.test(actual) : actual.includes(text);
    return { pass, message: () => `expected text ${JSON.stringify(actual)} ${pass ? "not " : ""}to contain ${String(text)}` };
  },
});
