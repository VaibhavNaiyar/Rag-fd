import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTE, formatRoute, normalizeRoute, parseRoute, viewRoute, type Route } from "./route";

describe("parseRoute", () => {
  it.each([
    ["#/console", { kind: "view", view: "console", q: "", sort: null }],
    ["#/traces", { kind: "view", view: "traces", q: "", sort: null }],
    ["#/traces?q=error&sort=ttft", { kind: "view", view: "traces", q: "error", sort: "ttft" }],
    ["#/metrics", { kind: "view", view: "metrics", q: "", sort: null }],
    ["#/inspect/s_1/t3", { kind: "inspect", sessionId: "s_1", turnId: "t3", tab: null }],
    ["#/inspect/s_1/t3?tab=timeline", { kind: "inspect", sessionId: "s_1", turnId: "t3", tab: "timeline" }],
  ] as [string, Route][])("%s", (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected);
  });

  it("accepts an address without the leading hash or slash", () => {
    expect(parseRoute("traces")).toEqual(viewRoute("traces"));
    expect(parseRoute("/metrics")).toEqual(viewRoute("metrics"));
  });

  it("decodes percent-encoded parts", () => {
    expect(parseRoute("#/traces?q=hello%20world%20%26%20more")).toMatchObject({ q: "hello world & more" });
    expect(parseRoute("#/inspect/s%2F1/t%203")).toMatchObject({ sessionId: "s/1", turnId: "t 3" });
  });

  it("drops a filter or a sort from a view that has neither", () => {
    expect(parseRoute("#/console?q=x&sort=y")).toEqual(viewRoute("console"));
    expect(parseRoute("#/metrics?q=x")).toEqual(viewRoute("metrics"));
  });

  it.each(["", "#", "#/", "#/nowhere", "#/console/extra", "#/inspect", "#/inspect/only-one", "#/inspect/a/b/c", "#/inspect//t1", "#/%E0%A4%A", "#//console", "####"])("sends %j to the console", (hash) => {
    expect(parseRoute(hash)).toEqual(DEFAULT_ROUTE);
  });
});

describe("formatRoute", () => {
  it("writes each route the way it is documented", () => {
    expect(formatRoute(viewRoute("console"))).toBe("#/console");
    expect(formatRoute({ kind: "view", view: "traces", q: "error", sort: "ttft" })).toBe("#/traces?q=error&sort=ttft");
    expect(formatRoute({ kind: "inspect", sessionId: "s_1", turnId: "t3", tab: "timeline" })).toBe("#/inspect/s_1/t3?tab=timeline");
  });

  it("leaves out what is empty", () => {
    expect(formatRoute({ kind: "view", view: "traces", q: "", sort: null })).toBe("#/traces");
    expect(formatRoute({ kind: "inspect", sessionId: "s", turnId: "t", tab: null })).toBe("#/inspect/s/t");
  });

  it("encodes what would break the address", () => {
    expect(formatRoute({ kind: "view", view: "traces", q: "a b&c=d#e", sort: null })).toBe("#/traces?q=a+b%26c%3Dd%23e");
    expect(formatRoute({ kind: "inspect", sessionId: "a/b", turnId: "c?d", tab: null })).toBe("#/inspect/a%2Fb/c%3Fd");
  });

  it("drops a filter that the view does not use", () => {
    expect(formatRoute({ kind: "view", view: "console", q: "x", sort: "y" })).toBe("#/console");
  });
});

/** A small deterministic generator, so a failure reproduces. */
function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const alphabet = ["a", "Z", "0", "_", "-", " ", "/", "?", "&", "=", "#", "%", "+", ".", "ü", "€", "😀", "\n", "\u0000", "~", "'", '"', "<", ">"];
  const text = (max: number) => Array.from({ length: Math.floor(next() * max) }, () => alphabet[Math.floor(next() * alphabet.length)]).join("");
  const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)] as T;
  return { next, text, pick };
}

describe("round trip (property test, 5,000 random routes)", () => {
  it("parses what it formats, for every route", () => {
    const random = generator(20260926);
    for (let round = 0; round < 5000; round += 1) {
      const route: Route =
        random.next() < 0.5
          ? { kind: "view", view: random.pick(["console", "traces", "metrics"] as const), q: random.text(12), sort: random.next() < 0.5 ? random.text(8) || null : null }
          : { kind: "inspect", sessionId: random.text(10) || "s", turnId: random.text(6) || "t", tab: random.next() < 0.5 ? random.text(8) || null : null };

      const address = formatRoute(route);
      const back = parseRoute(address);
      // A route means what it formats to: fields a view does not have are dropped, an empty id is not an id.
      const expected = route.kind === "inspect" ? route : route.view === "traces" ? route : viewRoute(route.view);
      expect(back, `${JSON.stringify(route)} -> ${address}`).toEqual(expected);
      expect(address.startsWith("#/")).toBe(true);
    }
  });

  it("is stable: formatting what was parsed gives the same address again, for any text at all", () => {
    const random = generator(99);
    for (let round = 0; round < 5000; round += 1) {
      const hash = random.next() < 0.5 ? `#/${random.text(30)}` : random.next() < 0.5 ? `#/traces?${random.text(30)}` : `#/inspect/${random.text(8)}/${random.text(8)}?${random.text(12)}`;
      const once = formatRoute(parseRoute(hash));
      expect(formatRoute(parseRoute(once)), hash).toBe(once);
    }
  });

  it("never throws and always gives a route, whatever the text", () => {
    const random = generator(4);
    for (let round = 0; round < 3000; round += 1) {
      const route = parseRoute(random.text(60));
      expect(["view", "inspect"]).toContain(route.kind);
    }
  });
});

describe("normalizeRoute", () => {
  it("leaves a route as an address would keep it", () => {
    expect(normalizeRoute({ kind: "view", view: "console", q: "x", sort: "y" })).toEqual(viewRoute("console"));
    expect(normalizeRoute({ kind: "inspect", sessionId: "s", turnId: "t", tab: "raw" })).toEqual({ kind: "inspect", sessionId: "s", turnId: "t", tab: "raw" });
  });
});
