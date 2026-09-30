import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiSlice, type UiSlice } from "@/store/uiSlice";

function harness() {
  let state!: UiSlice;
  const get = () => state;
  const set = (updater: (s: UiSlice) => Partial<UiSlice>) => {
    state = { ...state, ...updater(state) };
  };
  return { get, set };
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear = () => this.map.clear();
  getItem = (key: string) => this.map.get(key) ?? null;
  key = (index: number) => [...this.map.keys()][index] ?? null;
  removeItem = (key: string) => void this.map.delete(key);
  setItem = (key: string, value: string) => void this.map.set(key, value);
}

describe("uiSlice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to the console view, no selected turn, default density", () => {
    const { get, set } = harness();
    set(() => createUiSlice(set as never, get as never));
    expect(get().view).toBe("console");
    expect(get().selectedTurn).toBeNull();
    expect(get().density).toBe("default");
  });

  it("selectTurn and setInspectorTab update independently", () => {
    const { get, set } = harness();
    set(() => createUiSlice(set as never, get as never));
    get().selectTurn({ sessionId: "s1", turnId: "t1" });
    get().setInspectorTab("spans");
    expect(get().selectedTurn).toEqual({ sessionId: "s1", turnId: "t1" });
    expect(get().inspectorTab).toBe("spans");
    get().selectTurn(null);
    expect(get().selectedTurn).toBeNull();
    expect(get().inspectorTab).toBe("spans"); // unrelated, untouched
  });

  it("saveView replaces a view with the same name instead of duplicating it", () => {
    const { get, set } = harness();
    set(() => createUiSlice(set as never, get as never));
    get().saveView({ name: "Errors", filter: "errors > 0" });
    get().saveView({ name: "Errors", filter: "errors >= 1" });
    expect(get().savedViews).toHaveLength(1);
    expect(get().savedViews[0]?.filter).toBe("errors >= 1");
  });

  it("removeSavedView drops one by name", () => {
    const { get, set } = harness();
    set(() => createUiSlice(set as never, get as never));
    get().saveView({ name: "A", filter: "a" });
    get().saveView({ name: "B", filter: "b" });
    get().removeSavedView("A");
    expect(get().savedViews.map((v) => v.name)).toEqual(["B"]);
  });
});

describe("uiSlice: persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists density, columns and savedViews across a fresh slice instance", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });

    const { get: get1, set: set1 } = harness();
    set1(() => createUiSlice(set1 as never, get1 as never));
    get1().setDensity("compact");
    get1().setColumns(["turn", "mode", "cost"]);
    get1().saveView({ name: "Slow", filter: "latency > 2s" });

    const { get: get2, set: set2 } = harness();
    set2(() => createUiSlice(set2 as never, get2 as never));
    expect(get2().density).toBe("compact");
    expect(get2().columns).toEqual(["turn", "mode", "cost"]);
    expect(get2().savedViews).toEqual([{ name: "Slow", filter: "latency > 2s" }]);
  });

  it("does not persist the route-shaped fields (view, selectedTurn, inspectorTab) or filters/findQuery", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });

    const { get: get1, set: set1 } = harness();
    set1(() => createUiSlice(set1 as never, get1 as never));
    get1().setView("traces");
    get1().selectTurn({ sessionId: "s1", turnId: "t1" });
    get1().setFilters("mode = refine");
    get1().setFindQuery("Seoul");
    get1().setDensity("touch"); // triggers a write, so persistence is exercised

    const { get: get2, set: set2 } = harness();
    set2(() => createUiSlice(set2 as never, get2 as never));
    expect(get2().view).toBe("console");
    expect(get2().selectedTurn).toBeNull();
    expect(get2().filters).toBe("");
    expect(get2().findQuery).toBe("");
    expect(get2().density).toBe("touch"); // this one did persist
  });

  it("works with storage blocked: every action still updates state, nothing throws", () => {
    const blocked: Storage = {
      length: 0,
      clear: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("window", { localStorage: blocked });

    const { get, set } = harness();
    expect(() => set(() => createUiSlice(set as never, get as never))).not.toThrow();
    expect(() => get().setDensity("compact")).not.toThrow();
    expect(() => get().setColumns(["a"])).not.toThrow();
    expect(() => get().saveView({ name: "x", filter: "y" })).not.toThrow();
    expect(get().density).toBe("compact");
    expect(get().columns).toEqual(["a"]);
  });

  it("with no window at all (server-side), reads default state and every action still works", () => {
    const { get, set } = harness();
    expect(() => set(() => createUiSlice(set as never, get as never))).not.toThrow();
    expect(get().density).toBe("default");
    expect(() => get().setDensity("touch")).not.toThrow();
    expect(get().density).toBe("touch");
  });
});
