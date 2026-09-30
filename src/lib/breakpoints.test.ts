import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import { BREAKPOINT_PX, VIEWPORT_CLASSES, belowWidth, containerClassOf, isAtLeast, minWidth, tailwindScreens, viewportClassOf } from "./breakpoints";

describe("the scale", () => {
  it("is 480, 768, 1024, 1280, 1536 above the 375 px floor", () => {
    expect(BREAKPOINT_PX).toEqual({ sm: 480, md: 768, lg: 1024, xl: 1280, "2xl": 1536 });
  });

  it("writes media queries for a width and for the widths below it", () => {
    expect(minWidth("md")).toBe("(min-width: 768px)");
    expect(belowWidth("md")).toBe("(max-width: 767px)");
  });
});

describe("viewportClassOf", () => {
  it.each([
    [0, "xs"],
    [375, "xs"],
    [479, "xs"],
    [480, "sm"],
    [767, "sm"],
    [768, "md"],
    [1023, "md"],
    [1024, "lg"],
    [1279, "lg"],
    [1280, "xl"],
    [1535, "xl"],
    [1536, "2xl"],
    [3840, "2xl"],
  ] as const)("%i px is %s", (width, expected) => {
    expect(viewportClassOf(width)).toBe(expected);
  });

  it("is total: a width that is not a number is the smallest class", () => {
    expect(viewportClassOf(Number.NaN)).toBe("xs");
    expect(viewportClassOf(-10)).toBe("xs");
  });

  it("never steps down as the width grows", () => {
    let last = 0;
    for (let width = 0; width <= 2000; width += 1) {
      const rank = VIEWPORT_CLASSES.indexOf(viewportClassOf(width));
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
  });
});

describe("isAtLeast", () => {
  it("is true from the breakpoint upwards", () => {
    expect(isAtLeast("lg", "xs")).toBe(false);
    expect(isAtLeast("lg", "md")).toBe(false);
    expect(isAtLeast("lg", "lg")).toBe(true);
    expect(isAtLeast("lg", "2xl")).toBe(true);
  });
});

describe("containerClassOf", () => {
  it("has four classes, on the same steps", () => {
    expect([200, 479, 480, 767, 768, 1023, 1024, 4000].map(containerClassOf)).toEqual(["xs", "xs", "sm", "sm", "md", "md", "lg", "lg"]);
  });
});

describe("one source", () => {
  it("is what Tailwind's screens read", () => {
    expect(tailwindScreens()).toEqual({ sm: "480px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" });
    expect(config.theme?.screens).toEqual(tailwindScreens());
  });

  it("is repeated in layout.css exactly, since a media query cannot read a variable", () => {
    const css = readFileSync(path.resolve("src/styles/layout.css"), "utf8");
    const widths = [...css.matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map((match) => Number(match[1]));
    const allowed = new Set([BREAKPOINT_PX.md - 1, BREAKPOINT_PX.md, BREAKPOINT_PX.lg, BREAKPOINT_PX.lg - 1, BREAKPOINT_PX.sm - 1, BREAKPOINT_PX.sm]);
    for (const width of widths) expect(allowed.has(width), `layout.css uses ${width}px, which is not on the scale`).toBe(true);
    expect(widths.length).toBeGreaterThan(0);
  });

  /** Comments and string literals removed, so prose that mentions "480 px" does not count. */
  function code(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
      .replace(/`(?:\\.|[^`\\])*`/g, "``")
      .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
      .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
  }

  /**
   * Files allowed to contain these numbers. breakpoints.ts is the scale itself. layout.ts holds
   * the Inspector's widths (480 is its default width, which happens to equal a breakpoint; it is
   * not one). constants.ts and ControllerTimeline.tsx are legacy and go with the old shell (P12)
   * and the old timeline (P7).
   */
  const LEGACY = new Set([
    path.join("lib", "breakpoints.ts"),
    path.join("lib", "layout.ts"),
    path.join("lib", "constants.ts"),
    path.join("components", "trace", "ControllerTimeline.tsx"),
  ]);

  function sources(directory: string): string[] {
    return readdirSync(directory).flatMap((entry) => {
      const full = path.join(directory, entry);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it("leaves no other breakpoint in the TypeScript (the legacy files aside)", () => {
    const scale = new RegExp(`\\b(${Object.values(BREAKPOINT_PX).join("|")})\\b`);
    const offenders: string[] = [];
    for (const file of sources(path.resolve("src"))) {
      const relative = path.relative(path.resolve("src"), file);
      if (LEGACY.has(relative)) continue;
      const text = code(readFileSync(file, "utf8"));
      const at = text.search(scale);
      if (at >= 0) offenders.push(`${relative}: ${text.slice(Math.max(0, at - 20), at + 20).replace(/\s+/g, " ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("uses no (min|max)-width string in the TypeScript outside the scale's own file", () => {
    const offenders: string[] = [];
    for (const file of sources(path.resolve("src"))) {
      const relative = path.relative(path.resolve("src"), file);
      if (LEGACY.has(relative)) continue;
      if (/\((?:min|max)-width:\s*\d/.test(readFileSync(file, "utf8"))) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });
});
