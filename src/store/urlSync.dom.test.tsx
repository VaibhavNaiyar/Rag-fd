import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bindUrlSync, type UrlSyncStore } from "@/store/urlSync";
import type { SelectedTurn, UiSliceState } from "@/store/uiSlice";
import type { View } from "@/lib/route";

type Fields = Pick<UiSliceState, "view" | "selectedTurn" | "inspectorTab" | "filters">;

function fakeStore(initial: Fields): UrlSyncStore & { get: () => Fields; touch: () => void } {
  let state = initial;
  const listeners = new Set<(s: Fields) => void>();
  const notify = () => listeners.forEach((l) => l(state));
  return {
    get: () => state,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Notifies subscribers with the *same* fields — simulates an unrelated part of the real store changing (a trace finishing loading, a health poll), which still reaches this module because it subscribes to the whole store, not just these four fields. */
    touch: () => notify(),
    setView: (view: View) => {
      state = { ...state, view };
      notify();
    },
    selectTurn: (selectedTurn: SelectedTurn | null) => {
      state = { ...state, selectedTurn };
      notify();
    },
    setInspectorTab: (inspectorTab: string | null) => {
      state = { ...state, inspectorTab };
      notify();
    },
    setFilters: (filters: string) => {
      state = { ...state, filters };
      notify();
    },
  };
}

const BLANK: Fields = { view: "console", selectedTurn: null, inspectorTab: null, filters: "" };

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  window.location.hash = "";
});

describe("bindUrlSync", () => {
  it("applies the address the page was opened with to the store", () => {
    window.location.hash = "#/traces?q=error";
    const store = fakeStore(BLANK);
    const stop = bindUrlSync(store);
    expect(store.get()).toMatchObject({ view: "traces", filters: "error" });
    stop();
  });

  it("store -> hash: selecting a turn writes an inspect address", async () => {
    const store = fakeStore(BLANK);
    const stop = bindUrlSync(store);
    act(() => store.selectTurn({ sessionId: "s1", turnId: "t1" }));
    await waitFor(() => expect(window.location.hash).toBe("#/inspect/s1/t1"));
    stop();
  });

  it("hash -> store: Back/Forward (a hashchange) updates the store", async () => {
    const store = fakeStore(BLANK);
    const stop = bindUrlSync(store);
    act(() => void (window.location.hash = "#/inspect/s2/t9?tab=raw"));
    await waitFor(() => expect(store.get().selectedTurn).toEqual({ sessionId: "s2", turnId: "t9" }));
    expect(store.get().inspectorTab).toBe("raw");
    stop();
  });

  it("real navigation (opening a turn) adds a history entry", async () => {
    const store = fakeStore(BLANK);
    const stop = bindUrlSync(store);
    const before = window.history.length;
    act(() => store.selectTurn({ sessionId: "s1", turnId: "t1" }));
    await waitFor(() => expect(window.location.hash).toBe("#/inspect/s1/t1"));
    expect(window.history.length).toBe(before + 1);
    stop();
  });

  it("a same-place detail change (filters, inspector tab) replaces instead of pushing", async () => {
    window.location.hash = "#/traces"; // already there, so the initial sync does not treat the first filter as a fresh navigation
    const store = fakeStore({ ...BLANK, view: "traces" });
    const stop = bindUrlSync(store);
    act(() => store.setFilters("a"));
    await waitFor(() => expect(window.location.hash).toBe("#/traces?q=a"));
    const length = window.history.length;
    act(() => store.setFilters("ab"));
    await waitFor(() => expect(window.location.hash).toBe("#/traces?q=ab"));
    expect(window.history.length).toBe(length); // no new entry per keystroke
    stop();
  });

  it("no echo loop: the store's own write settles without re-triggering itself", async () => {
    const store = fakeStore(BLANK);
    let setViewCalls = 0;
    const wrapped: UrlSyncStore = {
      ...store,
      setView: (view) => {
        setViewCalls += 1;
        store.setView(view);
      },
    };
    const stop = bindUrlSync(wrapped);
    act(() => store.selectTurn({ sessionId: "s1", turnId: "t1" }));
    await waitFor(() => expect(window.location.hash).toBe("#/inspect/s1/t1"));
    // Give any stray hashchange a chance to fire before asserting quiescence.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(setViewCalls).toBe(0); // selecting a turn never touches `view`
    stop();
  });

  it("a direct hash write (AppFrame's own navigateTo) survives an unrelated store update that fires before the hashchange task runs", async () => {
    const store = fakeStore(BLANK);
    const stop = bindUrlSync(store);

    // AppFrame writes the hash directly, the way `navigateTo` does — not through a uiSlice setter.
    // `hashchange` has not fired yet, so `store.get().selectedTurn` is still null at this instant.
    act(() => void (window.location.hash = "#/inspect/s9/t9"));
    // An unrelated store change (e.g. ensureTrace marking a fetch as loading) reaches this
    // module's subscribe callback before the hashchange task does. It must not "correct" the
    // hash back to what the (stale) uiSlice fields still say.
    act(() => store.touch());
    expect(window.location.hash).toBe("#/inspect/s9/t9");

    // The hashchange eventually runs and the store catches up for real.
    await waitFor(() => expect(store.get().selectedTurn).toEqual({ sessionId: "s9", turnId: "t9" }));
    expect(window.location.hash).toBe("#/inspect/s9/t9");
    stop();
  });

  it("unbinds cleanly: after stop(), a hashchange no longer reaches the store", async () => {
    const store = fakeStore(BLANK);
    const stop = bindUrlSync(store);
    stop();
    act(() => void (window.location.hash = "#/metrics"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.get().view).toBe("console");
  });
});
