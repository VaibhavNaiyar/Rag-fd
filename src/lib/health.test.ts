import { afterEach, describe, expect, it, vi } from "vitest";
import { describeHealth, fetchHealth, healthUrl, parseHealth, type HealthResult } from "./health";

const OK_BODY = {
  status: "ok",
  version: "0.3.0",
  corpus: { docs: 12, chunks: 96, indexedAt: 1790000000000 },
  models: { embedder: "bge-small", llm: "gpt-5.4-mini", quota_per_intent: "4" },
};

const reply = (status: number, body: unknown) => Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("parseHealth", () => {
  it("reads the engine's answer", () => {
    expect(parseHealth(OK_BODY)).toEqual({
      version: "0.3.0",
      corpus: { docs: 12, chunks: 96, indexedAt: 1790000000000 },
      models: { embedder: "bge-small", llm: "gpt-5.4-mini", quota_per_intent: "4" },
    });
  });

  it("copes with a corpus or models it does not recognise", () => {
    expect(parseHealth({ status: "ok", version: "1", corpus: { docs: "many" }, models: { a: 1, b: "x" } })).toEqual({ version: "1", corpus: null, models: { b: "x" } });
    expect(parseHealth({ status: "ok", version: "1" })).toEqual({ version: "1", corpus: null, models: {} });
  });

  it.each([null, undefined, "ok", 3, [], {}, { status: "loading" }, { status: "ok" }, { status: "ok", version: 2 }])("is null for %j: that is not the engine", (body) => {
    expect(parseHealth(body)).toBeNull();
  });
});

describe("healthUrl", () => {
  it("uses NEXT_PUBLIC_ENGINE_URL when it is set, without doubling a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_ENGINE_URL", "http://engine.local:8000/");
    expect(healthUrl()).toBe("http://engine.local:8000/health");
    vi.stubEnv("NEXT_PUBLIC_ENGINE_URL", "http://engine.local:8000");
    expect(healthUrl()).toBe("http://engine.local:8000/health");
  });

  it("falls back to the same origin path when it is not", () => {
    vi.stubEnv("NEXT_PUBLIC_ENGINE_URL", "");
    expect(healthUrl()).toMatch(/\/health$/);
  });
});

describe("fetchHealth", () => {
  it("is ok with the parsed health and when it was asked", async () => {
    const result = await fetchHealth({ fetcher: () => reply(200, OK_BODY), now: () => 42 });
    expect(result).toMatchObject({ state: "ok", at: 42, health: { version: "0.3.0" } });
  });

  it("says loading while the engine warms its models (503)", async () => {
    expect(await fetchHealth({ fetcher: () => reply(503, { status: "loading" }) })).toEqual({ state: "loading" });
  });

  it("is unknown, not an error, for every other failure", async () => {
    const cases: (() => Promise<Response>)[] = [
      () => reply(500, "boom"),
      () => reply(404, { detail: "no" }),
      () => reply(503, { detail: "down" }),
      () => reply(200, "not json"),
      () => reply(200, { status: "ok" }),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ];
    for (const fetcher of cases) expect(await fetchHealth({ fetcher })).toEqual({ state: "unknown" });
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    const fetcher = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const pending = fetchHealth({ fetcher, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toEqual({ state: "unknown" });
  });

  it("stops when the caller aborts", async () => {
    const controller = new AbortController();
    const fetcher = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const pending = fetchHealth({ fetcher, signal: controller.signal, timeoutMs: 60_000 });
    controller.abort();
    expect(await pending).toEqual({ state: "unknown" });
  });

  it("asks for JSON from the health address", async () => {
    const fetcher = vi.fn(() => reply(200, OK_BODY));
    await fetchHealth({ fetcher: fetcher as unknown as typeof fetch });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/health$/);
    expect(init.headers).toEqual({ Accept: "application/json" });
  });
});

describe("describeHealth", () => {
  it("says what is known, and says when it is not", () => {
    const ok: HealthResult = { state: "ok", at: 1, health: { version: "0.3.0", corpus: null, models: {} } };
    expect(describeHealth({ state: "checking" })).toBe("Checking the engine");
    expect(describeHealth({ state: "loading" })).toBe("Engine is loading its models");
    expect(describeHealth({ state: "unknown" })).toBe("Engine health unknown");
    expect(describeHealth(ok)).toBe("Engine ok, version 0.3.0");
  });
});
