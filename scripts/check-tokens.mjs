#!/usr/bin/env node
/**
 * check-tokens — enforces the token rules of PHASES.md (R1, R3) with no dependencies.
 *
 *   node scripts/check-tokens.mjs                    the gate: exit 1 on any error
 *   node scripts/check-tokens.mjs --strict           every rule is an error; the baseline is ignored
 *   node scripts/check-tokens.mjs --update-baseline  rewrite scripts/check-tokens.baseline.json
 *   node scripts/check-tokens.mjs --verbose          also list the held and legacy findings
 *   node scripts/check-tokens.mjs --root <dir>       scan another tree (used to test this script)
 *
 * Rules
 *   V1  colour literal (hex, rgb(), hsl(), oklch()…) outside tokens.css        always an error
 *   V2  default Tailwind palette, or an arbitrary colour that is not a token   always an error
 *   V3  a primitive token (--sam-*, --slate-* …) used outside tokens.css       always an error
 *   V4  arbitrary length in a class name, e.g. w-[260px]                       ratchet
 *   V5  gradient                                                               ratchet
 *   V6  animate-* / @keyframes other than spin and sheet-in                    ratchet
 *   V7  rounded-full outside the status dot and the spinner                    ratchet
 *   V8  arbitrary font size, e.g. text-[11px]                                  ratchet
 *   V9  a legacy alias from the old token set                                  warning; error with --strict
 *
 * "Ratchet" means the legacy components may keep the findings they have today (the
 * counts in check-tokens.baseline.json) but may not add one. The colour rules have
 * no baseline: they are clean now and must stay clean. --strict, run from P12 on,
 * turns everything into an error.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const optionValue = (flag) => {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
};

const ROOT = path.resolve(optionValue("--root") ?? process.cwd());
const STRICT = has("--strict");
const VERBOSE = has("--verbose");
const UPDATE_BASELINE = has("--update-baseline");
const BASELINE_FILE = path.join(ROOT, "scripts", "check-tokens.baseline.json");
const ALLOWLIST_FILE = path.join(ROOT, "scripts", "token-allowlist.json");

const RATCHET = ["V4", "V5", "V6", "V7", "V8"];
const TITLES = {
  V1: "colour literals",
  V2: "default palette / arbitrary colours",
  V3: "primitives used outside tokens.css",
  V4: "arbitrary lengths",
  V5: "gradients",
  V6: "animations other than spin and sheet-in",
  V7: "rounded-full outside status dot and spinner",
  V8: "arbitrary font sizes",
  V9: "legacy aliases",
};

// ---------------------------------------------------------------- files

const SCAN_DIRS = ["src"];
const SCAN_FILES = ["tailwind.config.ts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const isTest = (rel) => /\.test\.tsx?$/.test(rel) || /\.dom\.test\.tsx?$/.test(rel) || rel.startsWith("src/test/");
const isTokensFile = (rel) => rel === "src/styles/tokens.css";

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry))) out.push(full);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir))),
  ...SCAN_FILES.map((file) => path.join(ROOT, file)).filter(existsSync),
]
  .map((full) => path.relative(ROOT, full).split(path.sep).join("/"))
  .filter((rel) => !isTest(rel) && !isTokensFile(rel))
  .sort();

const allowlist = existsSync(ALLOWLIST_FILE) ? JSON.parse(readFileSync(ALLOWLIST_FILE, "utf8")) : {};
const allowed = (rule, rel) => (allowlist[rule] ?? []).includes(rel);

// ---------------------------------------------------------------- comments

/**
 * Returns the source with every comment blanked to spaces (newlines kept, so
 * offsets still map to the same line and column) plus the comment text itself.
 */
function stripComments(source, isCss) {
  const chars = [...source];
  const comments = [];
  const blank = (from, to) => {
    comments.push(source.slice(from, to));
    for (let k = from; k < to; k += 1) if (chars[k] !== "\n") chars[k] = " ";
  };
  const n = source.length;
  let i = 0;
  if (isCss) {
    while (i < n) {
      if (source[i] === "/" && source[i + 1] === "*") {
        const end = source.indexOf("*/", i + 2);
        const stop = end < 0 ? n : end + 2;
        blank(i, stop);
        i = stop;
      } else i += 1;
    }
    return { code: chars.join(""), comments };
  }
  const templateStack = []; // brace depth at which each open `${` began
  let braceDepth = 0;
  let lastSignificant = "";
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? n : end;
      blank(i, stop);
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      i += 1;
      while (i < n && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
      i += 1;
      lastSignificant = c;
    } else if (c === "`") {
      i += 1;
      while (i < n && source[i] !== "`") {
        if (source[i] === "\\") i += 2;
        else if (source[i] === "$" && source[i + 1] === "{") {
          // A template expression is code again, up to its matching brace.
          templateStack.push(braceDepth);
          braceDepth += 1;
          i += 2;
          break;
        } else i += 1;
      }
      if (source[i] === "`") i += 1;
      lastSignificant = "`";
    } else if (c === "{") {
      braceDepth += 1;
      lastSignificant = c;
      i += 1;
    } else if (c === "}") {
      braceDepth -= 1;
      i += 1;
      if (templateStack.length > 0 && braceDepth === templateStack[templateStack.length - 1]) {
        templateStack.pop();
        // Back inside the template literal that opened this expression.
        while (i < n && source[i] !== "`") {
          if (source[i] === "\\") i += 2;
          else if (source[i] === "$" && source[i + 1] === "{") {
            templateStack.push(braceDepth);
            braceDepth += 1;
            i += 2;
            break;
          } else i += 1;
        }
        if (source[i] === "`") i += 1;
      }
      lastSignificant = "}";
    } else if (c === "/" && /[(,=:[!&|?{};]|^$|return|=>/.test(lastSignificant)) {
      // A regular-expression literal: skip it so its quotes are not read as strings.
      i += 1;
      let inClass = false;
      while (i < n && source[i] !== "\n") {
        if (source[i] === "\\") i += 2;
        else if (source[i] === "[") {
          inClass = true;
          i += 1;
        } else if (source[i] === "]") {
          inClass = false;
          i += 1;
        } else if (source[i] === "/" && !inClass) break;
        else i += 1;
      }
      i += 1;
      lastSignificant = "/";
    } else {
      if (!/\s/.test(c)) lastSignificant = c;
      i += 1;
    }
  }
  return { code: chars.join(""), comments };
}

// ---------------------------------------------------------------- patterns

const HEX = /(?<![\w&#/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COLOUR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])color\(\s*(?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz)/g;

const NAMED_COLOURS =
  "black|white|silver|gray|grey|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua|orange|pink|brown|gold|magenta|cyan|crimson|coral|salmon|tomato|indigo|violet|gainsboro|whitesmoke|lightgray|lightgrey|darkgray|darkgrey|dimgray|dimgrey|slategray|slategrey";
const COLOUR_PROPERTY =
  /^(?:color|background|background-color|border(?:-[a-z]+)*-color|border(?:-[a-z]+)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?)$/;

const PALETTE = "slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITY =
  "bg|text|border|border-[xytblrse]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|divide-[xy]|placeholder|caret|accent|decoration|shadow";
const DEFAULT_PALETTE = new RegExp(
  `(?<![\\w-])(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})-(?:50|[1-9]00|950)|white|black)(?:/\\d+)?(?![\\w-])`,
  "g",
);
const ARBITRARY_COLOUR = new RegExp(
  `(?<![\\w-])(?:${COLOUR_UTILITY})-\\[(?!var\\()[^\\]\\s]*(?:#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(|oklch\\(|lab\\(|lch\\(|hwb\\(|color-mix\\(|(?:${PALETTE}|white|black)(?![\\w-]))[^\\]\\s]*\\]`,
  "g",
);

const PRIMITIVE = /var\(\s*--(?:sam-blue|sam-navy|slate|steel|green|amber|red)-\d{2,3}\b/g;

const LENGTH_UTILITY = new Set(
  (
    "w h min-w max-w min-h max-h size p px py pt pr pb pl ps pe m mx my mt mr mb ml ms me gap gap-x gap-y space-x space-y " +
    "inset inset-x inset-y top right bottom left start end translate-x translate-y leading tracking " +
    "border border-x border-y border-t border-r border-b border-l border-s border-e " +
    "rounded rounded-t rounded-r rounded-b rounded-l rounded-tl rounded-tr rounded-br rounded-bl basis indent outline-offset"
  ).split(" "),
);
const ARBITRARY_VALUE = /(?<![\w-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[([^\]\s]+)\]/g;
const LENGTH_WITH_UNIT = /(?:^|[^\w.-])-?\d*\.?\d+(?:px|rem|em|%|vh|vw|dvh|svh|lvh|ch|ex)(?![\w])/;

const GRADIENT = /(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\s*\(|(?<![\w-])bg-gradient-[a-z-]+/g;

const ALLOWED_ANIMATIONS = new Set(["spin", "sheet-in", "none"]);
const ANIMATE_CLASS = /(?<![\w-])animate-([a-z][\w-]*)/g;
const KEYFRAMES = /@keyframes\s+([\w-]+)/g;
const ANIMATION_PROPERTY = /(?<![\w-])animation(?:-name)?\s*:\s*([\w-]+)/g;

const ROUNDED_FULL = /(?<![\w-])rounded-full(?![\w-])/g;
const ROUNDED_FULL_ALLOWED = new Set(["src/components/ui/StatusDot.tsx", "src/components/ui/Spinner.tsx"]);

const ARBITRARY_FONT_SIZE = /(?<![\w-])text-\[(?!var\()[^\]\s]+\]/g;

const LEGACY_TAILWIND = [
  [/(?<![\w-])(?:bg|text|border(?:-[xytblrse])?|fill|stroke|outline|divide|decoration|caret|accent|placeholder)-primary(?:-ink|-soft|-dark)?(?![\w-])/g],
  [/(?<![\w-])(?:bg|text|border(?:-[xytblrse])?|fill|stroke|outline|divide|decoration|caret|accent|placeholder)-(?:sunken|raised|brand)(?![\w-])/g],
  [/(?<![\w-])(?:bg|text|border(?:-[xytblrse])?|fill|stroke|outline|divide|decoration|caret|accent|placeholder)-edge-(?:primary|brand|ok|warn|error)(?![\w-])/g],
  [/(?<![\w-])text-error(?![\w-])/g],
  [/(?<![\w-])rounded(?:-[trbl]{1,2})?-(?:pill|sm|md|lg)(?![\w-])/g],
  [/(?<![\w-])shadow-(?:card|lift)(?![\w-])/g],
  [/(?<![\w-])animate-(?:rise-in|marker-in|message-in|flash-update|pulse-ring|pulse|ping|shimmer)(?![\w-])/g],
  [/(?<![\w-])ease-oneui(?![\w-])/g],
];
const LEGACY_VARIABLE =
  /var\(\s*--(?:ui-primary(?:-ink|-soft|-dark)?|on-primary|sam-blue|sunken|raised|border(?:-strong)?|edge-(?:primary|brand|ok|warn|error)|warn-hover|ai-glow|glow-(?:ok|primary)|radius-(?:sm|md|lg|pill)|shadow-(?:card|lift)|sidebar-w|trace-w|ease-oneui)(?![-\w])/g;

const LEGACY_HINTS = [
  [/-primary-ink$/, "-accent-ink"],
  [/-primary-soft$/, "-accent-soft"],
  [/-primary-dark$/, "-accent-ink"],
  [/-primary$/, "-accent"],
  [/-sunken$/, "-surface-2"],
  [/-raised$/, "-surface"],
  [/-brand$/, "-ink"],
  [/-edge-primary$/, "-accent-edge"],
  [/-edge-brand$/, "-line-strong"],
  [/-edge-(ok|warn|error)$/, "-$1-edge"],
  [/^text-error$/, "text-error-ink"],
  [/^rounded-(?:[trbl]{1,2}-)?pill$/, "rounded-2"],
  [/^rounded-(?:[trbl]{1,2}-)?sm$/, "rounded-1"],
  [/^rounded-(?:[trbl]{1,2}-)?md$/, "rounded-2"],
  [/^rounded-(?:[trbl]{1,2}-)?lg$/, "rounded-3"],
  [/^shadow-card$/, "(remove)"],
  [/^shadow-lift$/, "shadow-float"],
  [/^animate-/, "(remove)"],
  [/^ease-oneui$/, "ease-standard"],
  [/^var\(\s*--ui-primary-(?:ink|dark)$/, "var(--accent-ink"],
  [/^var\(\s*--ui-primary-soft$/, "var(--accent-soft"],
  [/^var\(\s*--ui-primary$/, "var(--accent"],
  [/^var\(\s*--on-primary$/, "var(--on-accent"],
  [/^var\(\s*--sam-blue$/, "var(--ink"],
  [/^var\(\s*--sunken$/, "var(--surface-2"],
  [/^var\(\s*--raised$/, "var(--surface"],
  [/^var\(\s*--border-strong$/, "var(--line-strong"],
  [/^var\(\s*--border$/, "var(--line"],
  [/^var\(\s*--edge-primary$/, "var(--accent-edge"],
  [/^var\(\s*--edge-brand$/, "var(--line-strong"],
  [/^var\(\s*--edge-(ok|warn|error)$/, "var(--$1-edge"],
  [/^var\(\s*--warn-hover$/, "var(--warn-soft"],
  [/^var\(\s*--(?:ai-glow|glow-ok|glow-primary)$/, "(remove)"],
  [/^var\(\s*--radius-sm$/, "var(--radius-1"],
  [/^var\(\s*--radius-(?:md|pill)$/, "var(--radius-2"],
  [/^var\(\s*--radius-lg$/, "var(--radius-3"],
  [/^var\(\s*--shadow-card$/, "(remove)"],
  [/^var\(\s*--shadow-lift$/, "var(--shadow-float"],
  [/^var\(\s*--(?:sidebar-w|trace-w)$/, "(layout tokens arrive in P4)"],
  [/^var\(\s*--ease-oneui$/, "var(--ease-standard"],
];
const legacyHint = (text) => {
  for (const [pattern, replacement] of LEGACY_HINTS) if (pattern.test(text)) return text.replace(pattern, replacement);
  return "see PHASES.md Appendix A and B";
};

// ---------------------------------------------------------------- scan

const findings = []; // { rule, file, line, col, text, hint? }
const commentColours = []; // informational: colour literals that only occur in comments

for (const rel of files) {
  const source = readFileSync(path.join(ROOT, rel), "utf8");
  const isCss = rel.endsWith(".css");
  const { code, comments } = stripComments(source, isCss);

  const lineStarts = [0];
  for (let k = 0; k < code.length; k += 1) if (code[k] === "\n") lineStarts.push(k + 1);
  const locate = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: index - lineStarts[lo] + 1 };
  };
  const report = (rule, index, text, hint) => {
    if (allowed(rule, rel)) return;
    findings.push({ rule, file: rel, ...locate(index), text, hint });
  };
  const scan = (rule, pattern, accept = () => true, hint) => {
    for (const match of code.matchAll(pattern)) {
      if (accept(match)) report(rule, match.index, match[0], hint?.(match[0]));
    }
  };

  // V1
  scan("V1", HEX);
  scan("V1", COLOUR_FUNCTION);
  if (isCss) {
    for (const match of code.matchAll(/(?<![\w-])([a-z-]+)\s*:\s*([^;{}]+)/g)) {
      const [, property, rawValue] = match;
      if (!COLOUR_PROPERTY.test(property)) continue;
      const value = rawValue.replace(/var\([^)]*\)/g, "var()");
      const named = value.match(new RegExp(`(?<![\\w-])(?:${NAMED_COLOURS})(?![\\w-])`, "i"));
      if (named) report("V1", match.index + match[0].indexOf(named[0], property.length), named[0]);
    }
  }
  for (const comment of comments) for (const found of comment.matchAll(HEX)) commentColours.push(`${rel}: ${found[0]}`);

  // V2, V3
  scan("V2", DEFAULT_PALETTE);
  scan("V2", ARBITRARY_COLOUR);
  scan("V3", PRIMITIVE);

  // V4
  for (const match of code.matchAll(ARBITRARY_VALUE)) {
    const [text, prefix, value] = match;
    if (!LENGTH_UTILITY.has(prefix) || value.includes("var(--")) continue;
    if (LENGTH_WITH_UNIT.test(value)) report("V4", match.index, text);
  }

  // V5
  scan("V5", GRADIENT);

  // V6
  scan("V6", ANIMATE_CLASS, (m) => !ALLOWED_ANIMATIONS.has(m[1]));
  if (isCss) {
    scan("V6", KEYFRAMES, (m) => !ALLOWED_ANIMATIONS.has(m[1]));
    scan("V6", ANIMATION_PROPERTY, (m) => !ALLOWED_ANIMATIONS.has(m[1]) && !["inherit", "initial", "unset"].includes(m[1]));
  }

  // V7
  if (!ROUNDED_FULL_ALLOWED.has(rel)) scan("V7", ROUNDED_FULL);

  // V8
  scan("V8", ARBITRARY_FONT_SIZE);

  // V9
  for (const [pattern] of LEGACY_TAILWIND) scan("V9", pattern, () => true, legacyHint);
  scan("V9", LEGACY_VARIABLE, () => true, legacyHint);
}

// ---------------------------------------------------------------- baseline

const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf8")) : {};

const tally = {};
for (const finding of findings) {
  if (!RATCHET.includes(finding.rule)) continue;
  tally[finding.rule] ??= {};
  tally[finding.rule][finding.file] = (tally[finding.rule][finding.file] ?? 0) + 1;
}

if (UPDATE_BASELINE) {
  const sorted = {};
  for (const rule of RATCHET) {
    const entries = Object.entries(tally[rule] ?? {}).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length > 0) sorted[rule] = Object.fromEntries(entries);
  }
  writeFileSync(BASELINE_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  const total = Object.values(sorted).flatMap((rule) => Object.values(rule)).reduce((a, b) => a + b, 0);
  console.log(`check-tokens: baseline written to ${path.relative(ROOT, BASELINE_FILE)} (${total} findings held in ${Object.keys(sorted).length} rules)`);
}

// ---------------------------------------------------------------- report

const errors = [];
const held = [];
const legacy = [];
for (const finding of findings) {
  if (finding.rule === "V9") (STRICT ? errors : legacy).push(finding);
  else if (!RATCHET.includes(finding.rule)) errors.push(finding);
  else if (STRICT) errors.push(finding);
  else {
    const allowedCount = baseline[finding.rule]?.[finding.file] ?? 0;
    const actual = tally[finding.rule]?.[finding.file] ?? 0;
    (actual > allowedCount ? errors : held).push({ ...finding, over: actual - allowedCount });
  }
}

const format = (finding) => {
  const where = `${finding.file}:${finding.line}:${finding.col}`;
  const note = finding.over > 0 ? `  (${finding.over} over the baseline for this file)` : "";
  const hint = finding.hint ? `  ->  ${finding.hint}` : "";
  return `  ${where.padEnd(48)} ${finding.rule}  ${finding.text}${hint}${note}`;
};

const countBy = (list, rule) => list.filter((finding) => finding.rule === rule).length;

if (errors.length > 0) {
  console.log("\ncheck-tokens: errors\n");
  for (const finding of errors) console.log(format(finding));
}
if (VERBOSE) {
  if (held.length > 0) console.log("\ncheck-tokens: held by the baseline\n");
  for (const finding of held) console.log(format(finding));
  if (legacy.length > 0) console.log("\ncheck-tokens: legacy aliases\n");
  for (const finding of legacy) console.log(format(finding));
}

console.log(`\ncheck-tokens: scanned ${files.length} files${STRICT ? " (strict)" : ""}`);
for (const rule of Object.keys(TITLES)) {
  const err = countBy(errors, rule);
  const extra = rule === "V9" ? countBy(legacy, rule) : countBy(held, rule);
  const label = rule === "V9" ? "legacy" : "held by baseline";
  const tail = extra > 0 ? `   (${extra} ${label})` : "";
  console.log(`  ${rule}  ${TITLES[rule].padEnd(44)} ${String(err).padStart(4)} error${err === 1 ? "" : "s"}${tail}`);
}
if (commentColours.length > 0) {
  console.log(`\n  info: ${commentColours.length} colour literal(s) in comments only: ${commentColours.join(", ")}`);
}
console.log(errors.length === 0 ? "\ncheck-tokens: OK" : `\ncheck-tokens: FAILED with ${errors.length} error(s)`);
process.exit(errors.length === 0 ? 0 : 1);
