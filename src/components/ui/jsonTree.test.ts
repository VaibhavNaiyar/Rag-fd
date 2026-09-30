import { describe, expect, it } from "vitest";
import { allCollectionIds, childrenOf, copyableValue, flatten, formatLeaf, initialExpanded, kindOf, pathToString, summarise } from "./jsonTree";

const RECORD = {
  turn_id: "t3",
  latency_ms: { first_token_abs: 1240, complete_abs: 2810 },
  retrieval: [
    { sub_query_id: "t3_sq1", kept: [{ chunk_id: "Doc_11_0", score: 0.83 }, { chunk_id: "Doc_02_4", score: 0.61 }] },
    { sub_query_id: "t3_sq2", kept: [] },
  ],
  uncertainty: null,
  degraded: false,
};

describe("kindOf", () => {
  it.each([
    [{}, "object"],
    [[], "array"],
    ["x", "string"],
    [1, "number"],
    [true, "boolean"],
    [null, "null"],
    [undefined, "null"],
  ] as const)("%j is %s", (value, kind) => {
    expect(kindOf(value)).toBe(kind);
  });
});

describe("pathToString", () => {
  it("writes the path a developer would type", () => {
    expect(pathToString([])).toBe("$");
    expect(pathToString(["retrieval", 0, "kept", 2, "chunk_id"])).toBe("$.retrieval[0].kept[2].chunk_id");
    expect(pathToString([3])).toBe("$[3]");
  });

  it("brackets and quotes a key that is not an identifier", () => {
    expect(pathToString(["a key", "b-c", "9lives"])).toBe('$["a key"]["b-c"]["9lives"]');
    expect(pathToString(['say "hi"'])).toBe('$["say \\"hi\\""]');
  });
});

describe("childrenOf", () => {
  it("lists an object's entries and an array's items, in order, and a leaf's none", () => {
    expect(childrenOf({ a: 1, b: 2 })).toEqual([["a", 1], ["b", 2]]);
    expect(childrenOf(["x", "y"])).toEqual([[0, "x"], [1, "y"]]);
    expect(childrenOf("text")).toEqual([]);
    expect(childrenOf(null)).toEqual([]);
  });
});

describe("flatten", () => {
  it("lists only the root when nothing is open", () => {
    const { nodes, truncated } = flatten(RECORD, new Set());
    expect(nodes.map((node) => node.id)).toEqual(["$"]);
    expect(nodes[0]).toMatchObject({ kind: "object", depth: 0, key: null, expandable: true, expanded: false, size: 5 });
    expect(truncated).toBe(false);
  });

  it("lists a node's children when it is open, and their children only when those are open too", () => {
    const one = flatten(RECORD, new Set(["$"])).nodes;
    expect(one.map((node) => node.id)).toEqual(["$", "$.turn_id", "$.latency_ms", "$.retrieval", "$.uncertainty", "$.degraded"]);

    const two = flatten(RECORD, new Set(["$", "$.retrieval"])).nodes;
    expect(two.map((node) => node.id)).toContain("$.retrieval[0]");
    expect(two.map((node) => node.id)).not.toContain("$.retrieval[0].kept");
  });

  it("gives every row a unique id, its depth, and its place among its siblings", () => {
    const { nodes } = flatten(RECORD, allCollectionIds(RECORD));
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
    const second = nodes.find((node) => node.id === "$.retrieval[1]");
    expect(second).toMatchObject({ depth: 2, position: 2, siblings: 2, key: 1 });
    const chunk = nodes.find((node) => node.id === "$.retrieval[0].kept[0].chunk_id");
    expect(chunk).toMatchObject({ depth: 5, kind: "string", value: "Doc_11_0", expandable: false });
  });

  it("does not make an empty collection expandable", () => {
    const { nodes } = flatten(RECORD, allCollectionIds(RECORD));
    expect(nodes.find((node) => node.id === "$.retrieval[1].kept")).toMatchObject({ kind: "array", size: 0, expandable: false });
  });

  it("does not follow a value that contains itself", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop.self = loop;
    const { nodes } = flatten(loop, new Set(["$", "$.self"]));
    expect(nodes.find((node) => node.id === "$.self")).toMatchObject({ expandable: false });
    expect(nodes.length).toBeLessThan(10);
  });

  it("stops at the row limit and says so", () => {
    const big = Array.from({ length: 50 }, (_, index) => index);
    const { nodes, truncated } = flatten(big, new Set(["$"]), 10);
    expect(nodes).toHaveLength(10);
    expect(truncated).toBe(true);
  });

  it("handles a primitive at the root", () => {
    const { nodes } = flatten("just text", new Set());
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: "$", kind: "string", expandable: false });
  });
});

describe("initialExpanded", () => {
  it("opens nothing at depth 0, the root at depth 1, and the root and its children at depth 2", () => {
    expect([...initialExpanded(RECORD, 0)]).toEqual([]);
    expect([...initialExpanded(RECORD, 1)]).toEqual(["$"]);
    expect([...initialExpanded(RECORD, 2)].sort()).toEqual(["$", "$.latency_ms", "$.retrieval"]);
  });

  it("opens every collection for expand all, and none of the leaves", () => {
    const all = allCollectionIds(RECORD);
    expect(all.has("$.retrieval[0].kept[1]")).toBe(true);
    expect(all.has("$.turn_id")).toBe(false);
  });
});

describe("text", () => {
  it("summarises collections with a count", () => {
    expect(summarise({ kind: "object", size: 5 })).toBe("5 keys");
    expect(summarise({ kind: "object", size: 1 })).toBe("1 key");
    expect(summarise({ kind: "array", size: 12 })).toBe("12 items");
    expect(summarise({ kind: "array", size: 1 })).toBe("1 item");
    expect(summarise({ kind: "array", size: 0 })).toBe("empty array");
    expect(summarise({ kind: "object", size: 0 })).toBe("empty object");
  });

  it("writes a leaf the way JSON does, with strings quoted and escaped", () => {
    expect(formatLeaf({ kind: "string", value: 'a "b"\n' })).toBe('"a \\"b\\"\\n"');
    expect(formatLeaf({ kind: "number", value: 0.83 })).toBe("0.83");
    expect(formatLeaf({ kind: "boolean", value: false })).toBe("false");
    expect(formatLeaf({ kind: "null", value: null })).toBe("null");
  });

  it("copies a string as itself and anything else as indented JSON", () => {
    expect(copyableValue("Doc_11_0")).toBe("Doc_11_0");
    expect(copyableValue({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(copyableValue(null)).toBe("null");
    expect(copyableValue(undefined)).toBe("null");
  });
});
