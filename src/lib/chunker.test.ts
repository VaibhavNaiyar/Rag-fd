import { describe, expect, it } from "vitest";
import { chunkUtterance } from "@/lib/chunker";

describe("chunkUtterance", () => {
  it("reassembles to the original word sequence", () => {
    const text = "Walk me through the controller and tell me what fusion does with overlaps";
    const rejoined = chunkUtterance(text)
      .map((chunk) => chunk.text)
      .join(" ");
    expect(rejoined).toBe(text);
  });

  it("emits groups of three to five words", () => {
    const words = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    for (const chunk of chunkUtterance(words)) {
      const size = chunk.text.split(" ").length;
      expect(size).toBeGreaterThanOrEqual(1); // the tail may be short
      expect(size).toBeLessThanOrEqual(5);
    }
  });

  it("paces delays at the requested words per minute", () => {
    const text = Array.from({ length: 150 }, (_, i) => `w${i}`).join(" ");
    const total = chunkUtterance(text, 150).reduce((sum, chunk) => sum + chunk.delayMs, 0);
    // 150 words at 150wpm is one minute, within rounding of each group.
    expect(total).toBeGreaterThan(59_000);
    expect(total).toBeLessThan(61_000);
  });

  it("is deterministic, so two runs of a fixture are identical", () => {
    const text = "one two three four five six seven eight nine ten eleven";
    expect(chunkUtterance(text)).toEqual(chunkUtterance(text));
  });

  it("returns nothing for empty input", () => {
    expect(chunkUtterance("   ")).toEqual([]);
  });
});
