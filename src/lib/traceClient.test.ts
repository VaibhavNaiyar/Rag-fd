import { describe, expect, it } from "vitest";
import { fetchRecent, fetchTrace } from "@/lib/traceClient";
import { loadTraceFixtures } from "@/test/fixtures";

function fakeFetch(handler: (url: string) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const { status, body } = await handler(String(input));
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

const realRecord = loadTraceFixtures()[0]?.records[0];

describe("fetchTrace", () => {
  it("ok: a valid record parses", async () => {
    const result = await fetchTrace("s1", "t1", { fetcher: fakeFetch(() => ({ status: 200, body: realRecord })) });
    expect(result.kind).toBe("ok");
  });

  it("evicted: 404 means the ring lost it, not an error", async () => {
    const result = await fetchTrace("s1", "t1", { fetcher: fakeFetch(() => ({ status: 404, body: { detail: "no such turn" } })) });
    expect(result).toEqual({ kind: "evicted" });
  });

  it("http: a non-404 error status", async () => {
    const result = await fetchTrace("s1", "t1", { fetcher: fakeFetch(() => ({ status: 500, body: {} })) });
    expect(result).toEqual({ kind: "http", status: 500 });
  });

  it("schema: 200 with a body that is not a valid trace record", async () => {
    const result = await fetchTrace("s1", "t1", { fetcher: fakeFetch(() => ({ status: 200, body: { not: "a trace" } })) });
    expect(result.kind).toBe("schema");
  });

  it("network: fetch throws (offline, refused, timed out)", async () => {
    const thrower: typeof fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const result = await fetchTrace("s1", "t1", { fetcher: thrower });
    expect(result.kind === "network" || result.kind === "cors").toBe(true);
  });

  it("never throws even when the fetcher rejects with something unexpected", async () => {
    const thrower: typeof fetch = (async () => {
      throw new Error("boom");
    }) as typeof fetch;
    await expect(fetchTrace("s1", "t1", { fetcher: thrower })).resolves.toBeDefined();
  });
});

describe("fetchRecent", () => {
  it("ok: parses every record, dropping ones that fail schema and counting them", async () => {
    const result = await fetchRecent(
      { limit: 10 },
      { fetcher: fakeFetch(() => ({ status: 200, body: { traces: [realRecord, { bogus: true }] } })) },
    );
    expect(result).toMatchObject({ kind: "ok", skipped: 1 });
    if (result.kind === "ok") expect(result.records).toHaveLength(1);
  });

  it("http: a non-2xx status", async () => {
    const result = await fetchRecent({}, { fetcher: fakeFetch(() => ({ status: 503, body: {} })) });
    expect(result).toEqual({ kind: "http", status: 503 });
  });

  it("clamps limit into [1, 200]", async () => {
    let seenUrl = "";
    await fetchRecent({ limit: 5000 }, { fetcher: fakeFetch((url) => ((seenUrl = url), { status: 200, body: { traces: [] } })) });
    expect(seenUrl).toContain("limit=200");
  });
});
