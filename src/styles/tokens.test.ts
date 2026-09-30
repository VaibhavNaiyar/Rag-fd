import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import manifest from "./tokens.contrast.json";

/*
 * The token contract, executed. It parses tokens.css itself (no CSS library),
 * resolves every var() chain per theme, and checks the things the design system
 * promises: identity colours, both themes complete, every colour literal inside
 * the primitives block, the contrast manifest, and a Tailwind config that cannot
 * produce a colour outside the tokens.
 */

// ------------------------------------------------------------------ parsing

type Declaration = readonly [property: string, value: string];
interface Rule {
  media: string | null;
  selector: string;
  declarations: Declaration[];
}
type Theme = "light" | "dark";

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitDeclarations(body: string): Declaration[] {
  const out: Declaration[] = [];
  let depth = 0;
  let current = "";
  const flush = () => {
    const colon = current.indexOf(":");
    if (colon > 0) out.push([current.slice(0, colon).trim(), current.slice(colon + 1).replace(/\s+/g, " ").trim()]);
    current = "";
  };
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === ";" && depth === 0) flush();
    else current += char;
  }
  flush();
  return out;
}

function parseRules(text: string, media: string | null = null, out: Rule[] = []): Rule[] {
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{", index);
    if (open < 0) break;
    const prelude = text.slice(index, open).trim().replace(/\s+/g, " ");
    let depth = 1;
    let close = open + 1;
    while (close < text.length && depth > 0) {
      if (text.charAt(close) === "{") depth += 1;
      else if (text.charAt(close) === "}") depth -= 1;
      close += 1;
    }
    const inner = text.slice(open + 1, close - 1);
    if (prelude.startsWith("@media")) parseRules(inner, prelude, out);
    else out.push({ media, selector: prelude, declarations: splitDeclarations(inner) });
    index = close;
  }
  return out;
}

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");
const rules = parseRules(stripComments(css));

const collect = (list: Rule[]): Map<string, string> => new Map(list.flatMap((rule) => rule.declarations));
const lightRules = rules.filter((rule) => rule.media === null && rule.selector === ":root");
const darkMediaRules = rules.filter(
  (rule) => rule.media === "@media (prefers-color-scheme: dark)" && rule.selector === ':root:not([data-theme="light"])',
);
const darkAttributeRules = rules.filter((rule) => rule.media === null && rule.selector === ':root[data-theme="dark"]');

const light = collect(lightRules);
const darkMedia = collect(darkMediaRules);
const darkAttribute = collect(darkAttributeRules);
const tokens: Record<Theme, Map<string, string>> = {
  light,
  dark: new Map([...light, ...darkAttribute]),
};

/** Custom properties supplied at runtime by next/font, not by this file. */
const EXTERNAL = new Set(["--font-inter", "--font-jetbrains"]);

function resolve(name: string, theme: Theme, trail: string[] = []): string {
  const value = tokens[theme].get(name);
  if (value === undefined) throw new Error(`${name} is not defined (${theme})`);
  if (trail.includes(name)) throw new Error(`${[...trail, name].join(" -> ")} is a cycle`);
  return value.replace(/var\((--[a-z0-9-]+)\)/gi, (_, reference: string) =>
    EXTERNAL.has(reference) ? `var(${reference})` : resolve(reference, theme, [...trail, name]),
  );
}

const hex = (name: string, theme: Theme): string => resolve(name, theme).toLowerCase();

// ---------------------------------------------------------------- contrast

function luminance(colour: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(colour.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

interface ManifestGroup {
  kind: string;
  min: number;
  note: string;
  foregrounds?: string[];
  on?: string;
  pairs?: [string, string][];
}

interface Pair {
  kind: string;
  min: number;
  foreground: string;
  background: string;
}

function expandManifest(): Pair[] {
  const groups = manifest.groups as ManifestGroup[];
  return groups.flatMap((group) => {
    const explicit = (group.pairs ?? []).map(([foreground, background]) => ({ foreground, background }));
    const onSurfaces = group.on === "surfaces" ? (group.foregrounds ?? []).flatMap((foreground) => manifest.surfaces.map((background) => ({ foreground, background }))) : [];
    return [...explicit, ...onSurfaces].map((pair) => ({ kind: group.kind, min: group.min, ...pair }));
  });
}

// ---------------------------------------------------------------- contract

/** Every colour token components may use, by role. */
const SEMANTIC = [
  "--canvas", "--surface", "--surface-2", "--surface-3",
  "--line", "--line-strong", "--line-control",
  "--ink", "--ink-body", "--ink-muted",
  "--accent", "--accent-hover", "--accent-press", "--accent-ink", "--on-accent", "--accent-soft", "--accent-edge", "--focus-ring",
  "--control", "--control-hover", "--control-press", "--on-control",
  "--chrome", "--chrome-hover", "--chrome-line", "--on-chrome", "--on-chrome-muted", "--focus-on-chrome",
  "--ok", "--ok-ink", "--ok-soft", "--ok-edge",
  "--warn", "--warn-ink", "--warn-soft", "--warn-edge",
  "--error", "--error-ink", "--error-soft", "--error-edge",
  "--state-wait", "--state-retrieve", "--state-refine", "--state-suppress",
  "--span-listen", "--span-plan", "--span-retrieve", "--span-synthesise", "--span-cancel",
  "--diff-added", "--diff-removed", "--diff-rewritten",
  "--scrim",
] as const;

/** The 48 names the previous token set defined; the old components still read them. */
const LEGACY = [
  "--sam-blue", "--ui-primary", "--ui-primary-ink", "--ui-primary-dark", "--ui-primary-soft", "--on-primary",
  "--canvas", "--surface", "--sunken", "--raised", "--border", "--border-strong", "--ink", "--ink-body", "--ink-muted",
  "--ok", "--ok-ink", "--ok-soft", "--warn", "--warn-ink", "--warn-soft", "--error", "--error-soft",
  "--state-wait", "--state-retrieve", "--state-suppress", "--state-refine",
  "--ai-glow", "--glow-ok", "--glow-primary",
  "--edge-primary", "--edge-brand", "--edge-ok", "--edge-warn", "--edge-error", "--warn-hover", "--scrim",
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-pill", "--shadow-card", "--shadow-lift",
  "--font-ui", "--font-mono", "--sidebar-w", "--trace-w", "--ease-oneui",
] as const;

const DEFAULT_PALETTE_KEYS = [
  "slate", "gray", "grey", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
  "white", "black", "lightBlue", "warmGray", "trueGray", "coolGray", "blueGray",
];

describe("tokens.css structure", () => {
  it("writes the dark theme twice, identically", () => {
    expect(darkMedia.size).toBeGreaterThan(30);
    expect([...darkMedia]).toEqual([...darkAttribute]);
  });

  it("keeps every colour literal inside the primitives block", () => {
    const primitives = lightRules.find((rule) => rule.declarations.some(([property]) => property === "--sam-blue-050"));
    expect(primitives).toBeDefined();
    const literal = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\blab\(|\bhwb\(/i;
    const offenders = rules
      .filter((rule) => rule !== primitives)
      .flatMap((rule) => rule.declarations)
      .filter(([, value]) => literal.test(value.replace(/var\(--[a-z0-9-]+\)/gi, "var()")))
      .map(([property, value]) => `${property}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it("defines the primitives as unique six-digit hex values", () => {
    const primitives = lightRules.find((rule) => rule.declarations.some(([property]) => property === "--sam-blue-050"));
    const values = (primitives?.declarations ?? []).map(([, value]) => value);
    expect(values.length).toBeGreaterThan(50);
    expect(values.filter((value) => !/^#[0-9a-f]{6}$/.test(value))).toEqual([]);
    expect(values.filter((value, at) => values.indexOf(value) !== at)).toEqual([]);
  });

  it("uses no gradient and no radius above 6px", () => {
    for (const [property, value] of tokens.light) expect(`${property}: ${value}`).not.toMatch(/gradient/i);
    expect(["--radius-0", "--radius-1", "--radius-2", "--radius-3"].map((name) => tokens.light.get(name))).toEqual(["0px", "2px", "4px", "6px"]);
  });

  it("resolves every var() in both themes, without a cycle", () => {
    for (const theme of ["light", "dark"] as const) for (const name of tokens[theme].keys()) expect(() => resolve(name, theme)).not.toThrow();
  });

  it("keeps every token name of the previous set defined", () => {
    expect(LEGACY.filter((name) => !tokens.light.has(name))).toEqual([]);
  });
});

describe("identity", () => {
  it("uses Cool Slate for the canvas: #F4F6F9 light, #0F172A dark", () => {
    expect(hex("--canvas", "light")).toBe("#f4f6f9");
    expect(hex("--canvas", "dark")).toBe("#0f172a");
  });

  it("uses Samsung Blue #1428A0 as the accent in both themes", () => {
    expect(hex("--accent", "light")).toBe("#1428a0");
    expect(hex("--accent", "dark")).toBe("#1428a0");
  });

  it("uses Deep Navy #0C2340 for ink, controls and chrome in the light theme", () => {
    for (const name of ["--ink", "--control", "--chrome"]) expect(hex(name, "light")).toBe("#0c2340");
  });

  it("keeps Samsung Blue off dark surfaces as text: --accent-ink is lightened there", () => {
    expect(contrast(hex("--accent", "dark"), hex("--canvas", "dark"))).toBeLessThan(3);
    expect(contrast(hex("--accent-ink", "dark"), hex("--canvas", "dark"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("semantic tokens", () => {
  it("defines every one, resolving to a colour, in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const name of SEMANTIC) {
        const value = resolve(name, theme);
        expect(value, `${name} (${theme})`).toMatch(/^#[0-9a-f]{6}$|^color-mix\(/);
      }
    }
  });

  it("gives the dark theme its own value for every token that has to differ", () => {
    const shared = ["--accent", "--on-accent", "--on-chrome", "--on-chrome-muted", "--focus-on-chrome"];
    for (const name of SEMANTIC) {
      if (shared.includes(name)) continue;
      const followsAlias = (tokens.light.get(name) ?? "").startsWith("var(--") && !darkAttribute.has(name);
      if (followsAlias) continue;
      expect(darkAttribute.has(name), `${name} has no dark value`).toBe(true);
    }
  });
});

describe("contrast manifest", () => {
  const pairs = expandManifest();

  it("holds 102 pairs per theme", () => {
    expect(pairs).toHaveLength(102);
  });

  for (const theme of ["light", "dark"] as const) {
    it(`meets every minimum in the ${theme} theme`, () => {
      const failures = pairs
        .map((pair) => ({ ...pair, ratio: contrast(hex(pair.foreground, theme), hex(pair.background, theme)) }))
        .filter((pair) => pair.ratio < pair.min)
        .map((pair) => `${pair.kind}: ${pair.foreground} on ${pair.background} is ${pair.ratio.toFixed(2)}:1, needs ${pair.min}`);
      expect(failures).toEqual([]);
    });
  }

  it("covers every semantic colour token, or says why it is decorative", () => {
    const covered = new Set(pairs.flatMap((pair) => [pair.foreground, pair.background]));
    const decorative = new Set(Object.keys(manifest.decorative));
    expect(SEMANTIC.filter((name) => !covered.has(name) && !decorative.has(name))).toEqual([]);
    expect([...decorative].filter((name) => covered.has(name))).toEqual([]);
  });
});

describe("tailwind.config.ts", () => {
  const colours = (config.theme?.colors ?? {}) as Record<string, unknown>;

  function flatten(value: unknown, path: string, out: [string, string][] = []): [string, string][] {
    if (typeof value === "string") out.push([path, value]);
    else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) flatten(child, `${path}.${key}`, out);
    return out;
  }
  const entries = flatten(colours, "colors");

  it("replaces the default palette instead of extending it", () => {
    expect(config.theme?.extend && "colors" in config.theme.extend).toBe(false);
    expect(Object.keys(colours).filter((key) => DEFAULT_PALETTE_KEYS.includes(key))).toEqual([]);
  });

  it("resolves every colour to a defined token", () => {
    const allowed = new Set(["transparent", "currentColor", "inherit"]);
    const bad = entries.filter(([, value]) => !allowed.has(value) && !/^var\(--[a-z0-9-]+\)$/.test(value)).map(([path, value]) => `${path} = ${value}`);
    expect(bad).toEqual([]);
    const undefinedTokens = entries
      .map(([, value]) => /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1])
      .filter((name): name is string => name !== undefined && !tokens.light.has(name));
    expect(undefinedTokens).toEqual([]);
  });

  it("has no gradients and no ring utilities", () => {
    expect(config.theme?.backgroundImage).toEqual({});
    expect(config.corePlugins).toMatchObject({ gradientColorStops: false, ringWidth: false });
  });

  it("allows only the spin and sheet-in animations", () => {
    expect(Object.keys((config.theme?.keyframes ?? {}) as object).sort()).toEqual(["sheet-in", "spin"]);
    expect(Object.keys((config.theme?.animation ?? {}) as object).sort()).toEqual(["none", "sheet-in", "spin"]);
  });
});
