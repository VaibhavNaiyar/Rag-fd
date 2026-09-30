import { describe, expect, it, vi } from "vitest";
import { createTraceSlice, type TraceSlice } from "@/store/traceSlice";
import { loadTraceFixtures } from "@/test/fixtures";
import type { FetchTraceResult } from "@/lib/traceClient";

/** A minimal store harness: real zustand-style set/get over a plain object, enough to exercise a slice without pulling in `useAppStore`. */
function harness() {
  let state!: TraceSlice;
  const get = () => state;
  const set = (updater: (s: TraceSlice) => Partial<TraceSlice>) => {
    state = { ...state, ...updater(state) };
  };
  return { get, set };
}

const record = loadTraceFixtures()[0]!.records[0]!;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("traceSlice: ensureTrace", () => {
  it("goes idle -> loading -> ready on a successful fetch", async () => {
    const { get, set } = harness();
    const fetchTrace = vi.fn(async (): Promise<FetchTraceResult> => ({ kind: "ok", record }));
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);

    expect(get().traceFor("s1", "t1").status).toBe("idle");
    get().ensureTrace("s1", "t1");
    expect(get().traceFor("s1", "t1").status).toBe("loading");
    await vi.waitFor(() => expect(get().traceFor("s1", "t1").status).toBe("ready"));
    expect(get().traceFor("s1", "t1").record).toBe(record);
  });

  it("evicted -> missing, not an error", async () => {
    const { get, set } = harness();
    const fetchTrace = vi.fn(async (): Promise<FetchTraceResult> => ({ kind: "evicted" }));
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);
    get().ensureTrace("s1", "t1");
    await vi.waitFor(() => expect(get().traceFor("s1", "t1").status).toBe("missing"));
  });

  it("a network failure lands in a human-readable error, not the raw kind", async () => {
    const { get, set } = harness();
    const fetchTrace = vi.fn(async (): Promise<FetchTraceResult> => ({ kind: "network" }));
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);
    get().ensureTrace("s1", "t1");
    await vi.waitFor(() => expect(get().traceFor("s1", "t1").status).toBe("error"));
    expect(get().traceFor("s1", "t1").error).toMatch(/reach the engine/i);
  });

  it("concurrency: two callers wanting the same turn at once share one fetch", async () => {
    const { get, set } = harness();
    const { promise, resolve } = deferred<FetchTraceResult>();
    const fetchTrace = vi.fn(() => promise);
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);

    get().ensureTrace("s1", "t1");
    get().ensureTrace("s1", "t1");
    get().ensureTrace("s1", "t1");
    expect(fetchTrace).toHaveBeenCalledTimes(1);

    resolve({ kind: "ok", record });
    await vi.waitFor(() => expect(get().traceFor("s1", "t1").status).toBe("ready"));
    expect(fetchTrace).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch a turn that is already ready", async () => {
    const { get, set } = harness();
    const fetchTrace = vi.fn(async (): Promise<FetchTraceResult> => ({ kind: "ok", record }));
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);
    get().ensureTrace("s1", "t1");
    await vi.waitFor(() => expect(get().traceFor("s1", "t1").status).toBe("ready"));
    get().ensureTrace("s1", "t1");
    expect(fetchTrace).toHaveBeenCalledTimes(1);
  });

  it("turn_id repeats across sessions: two sessions' t1 are cached separately", async () => {
    const { get, set } = harness();
    const fetchTrace = vi.fn(async (sessionId: string): Promise<FetchTraceResult> => ({ kind: "ok", record: { ...record, session_id: sessionId } }));
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);
    get().ensureTrace("s1", "t1");
    get().ensureTrace("s2", "t1");
    await vi.waitFor(() => {
      expect(get().traceFor("s1", "t1").status).toBe("ready");
      expect(get().traceFor("s2", "t1").status).toBe("ready");
    });
    expect(get().traceFor("s1", "t1").record?.session_id).toBe("s1");
    expect(get().traceFor("s2", "t1").record?.session_id).toBe("s2");
  });

  it("invalidateTrace clears a cached entry so the next call re-fetches", async () => {
    const { get, set } = harness();
    const fetchTrace = vi.fn(async (): Promise<FetchTraceResult> => ({ kind: "ok", record }));
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);
    get().ensureTrace("s1", "t1");
    await vi.waitFor(() => expect(get().traceFor("s1", "t1").status).toBe("ready"));
    get().invalidateTrace("s1", "t1");
    expect(get().traceFor("s1", "t1").status).toBe("idle");
    get().ensureTrace("s1", "t1");
    await vi.waitFor(() => expect(fetchTrace).toHaveBeenCalledTimes(2));
  });

  it("caps at 200 entries, evicting least-recently-touched first", async () => {
    const { get, set } = harness();
    const calls: Promise<FetchTraceResult>[] = [];
    const fetchTrace = vi.fn(() => {
      const p = Promise.resolve<FetchTraceResult>({ kind: "ok", record });
      calls.push(p);
      return p;
    });
    const slice = createTraceSlice(set as never, get as never, { fetchTrace });
    set(() => slice);

    for (let i = 0; i < 205; i += 1) get().ensureTrace("s1", `t${i}`);
    await Promise.all(calls);
    await Promise.resolve();
    await Promise.resolve();

    expect(Object.keys(get().traces)).toHaveLength(200);
    expect(get().traceFor("s1", "t0").status).toBe("idle"); // evicted
    expect(get().traceFor("s1", "t204").status).toBe("ready"); // most recent, kept
  }, 10000);
});
