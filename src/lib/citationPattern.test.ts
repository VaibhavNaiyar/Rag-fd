import { describe, expect, it } from "vitest";
import { containsCitation, findCitationMarkers } from "@/lib/citationPattern";
import { resolveCitation } from "@/store/selectors";
import type { Hit } from "@/types/events";

const markersIn = (text: string) => findCitationMarkers(text).map((match) => match.marker);

describe("findCitationMarkers", () => {
  it("matches the engine's marker format", () => {
    expect(markersIn("The controller waits [Doc_12 §2.1].")).toEqual(["[Doc_12 §2.1]"]);
  });

  it("finds several markers in one sentence", () => {
    expect(markersIn("a [Doc_1 §1] b [Doc_31 §4.2] c")).toEqual(["[Doc_1 §1]", "[Doc_31 §4.2]"]);
  });

  it("reports spans that reconstruct the original text", () => {
    const text = "before [Doc_7 §3.4] after";
    const match = findCitationMarkers(text)[0];
    expect(match).toBeDefined();
    expect(text.slice(match?.start ?? 0, match?.end ?? 0)).toBe("[Doc_7 §3.4]");
  });

  it("ignores bracketed text that is not a citation", () => {
    expect(markersIn("a [note] and [1] and [see below]")).toEqual([]);
  });

  it("does not run across a line break", () => {
    expect(markersIn("[Doc_1 §\nstill going]")).toEqual([]);
  });

  it("does not swallow a long span of prose", () => {
    const runaway = `[Doc_1 §${"x".repeat(80)}]`;
    expect(markersIn(runaway)).toEqual([]);
  });

  it("is not stateful between calls", () => {
    const text = "[Doc_1 §1]";
    expect(containsCitation(text)).toBe(true);
    expect(containsCitation(text)).toBe(true);
    expect(markersIn(text)).toHaveLength(1);
    expect(markersIn(text)).toHaveLength(1);
  });
});

describe("resolveCitation", () => {
  const hit: Hit = {
    chunkId: "chunk_0001",
    docId: "Doc_12",
    section: "2.1",
    text: "…",
    score: 0.9,
    branches: ["dense"],
    subQueryIds: ["s1"],
    citation: "[Doc_12 §2.1]",
  };

  it("resolves a marker the engine actually returned", () => {
    expect(resolveCitation([hit], "[Doc_12 §2.1]")?.chunkId).toBe("chunk_0001");
  });

  it("returns null for a marker with no backing chunk, so it renders unverified", () => {
    expect(resolveCitation([hit], "[Doc_999 §1]")).toBeNull();
  });

  it("tolerates surrounding whitespace and case", () => {
    expect(resolveCitation([hit], " [doc_12 §2.1] ")?.chunkId).toBe("chunk_0001");
  });
});
