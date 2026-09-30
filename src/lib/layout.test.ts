import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INSPECTOR, clampInspector } from "./layout";

describe("INSPECTOR", () => {
  const tokens = readFileSync(path.resolve("src/styles/tokens.css"), "utf8");
  const token = (name: string) => Number(new RegExp(`${name}:\\s*(\\d+)px`).exec(tokens)?.[1]);

  it("matches the layout tokens", () => {
    expect(INSPECTOR.min).toBe(token("--inspector-min"));
    expect(INSPECTOR.max).toBe(token("--inspector-max"));
    expect(INSPECTOR.default).toBe(token("--inspector-w"));
  });
});

describe("clampInspector", () => {
  it("leaves a width inside its limits alone, rounded", () => {
    expect(clampInspector(480, 1400)).toBe(480);
    expect(clampInspector(480.6, 1400)).toBe(481);
  });

  it("holds the width to the minimum and the maximum", () => {
    expect(clampInspector(100, 1400)).toBe(360);
    expect(clampInspector(2000, 2400)).toBe(720);
  });

  it("leaves the view its room: the Inspector gives way as the row narrows", () => {
    expect(clampInspector(700, 968)).toBe(608);
    expect(clampInspector(700, 1100)).toBe(700);
  });

  it("never goes below the minimum, even on a row too narrow for both", () => {
    expect(clampInspector(500, 600)).toBe(360);
  });
});
