#!/usr/bin/env node
/**
 * baseline-report — turns a Playwright run into docs/baseline/REPORT.md.
 *
 *   npm run build && npm run test:e2e && npm run baseline:report
 *
 * It reads what the overflow and accessibility specs recorded in
 * e2e/.cache/baseline (baseline mode), runs `check-tokens --strict` for the
 * token burn-down, measures the static export's first-load bundle, and copies a
 * few of the visual snapshots next to the report. It also writes
 * docs/baseline/bundle.json, the budget scripts/check-bundle.mjs will hold the
 * build to.
 *
 * The report describes the state of the code at the moment it is run. It is a
 * dated measurement, not a specification.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, "e2e", ".cache", "baseline");
const OUT = path.join(ROOT, "docs", "baseline");
const SCREENS = path.join(OUT, "screens");

if (!existsSync(BASELINE)) {
  console.error("baseline-report: no e2e/.cache/baseline. Run `npm run test:e2e` first.");
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const run = (command, args) => spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

// ---------------------------------------------------------------- measurements

const records = readdirSync(BASELINE, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((directory) =>
    readdirSync(path.join(BASELINE, directory.name))
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson(path.join(BASELINE, directory.name, name))),
  );

const projectOrder = (name) => {
  const [width, scheme] = name.split("-");
  return Number(width) * 10 + (scheme === "dark" ? 1 : 0);
};
const projects = [...new Set(records.map((record) => record.project))].sort((a, b) => projectOrder(a) - projectOrder(b));
const states = [...new Set(records.map((record) => record.state))];

const overflow = records.filter((record) => record.kind === "overflow");
const a11y = records.filter((record) => record.kind === "a11y");

const overflowByProject = projects.map((project) => {
  const own = overflow.filter((record) => record.project === project);
  return { project, states: own.length, defects: own.reduce((sum, record) => sum + record.count, 0) };
});

const offenders = new Map();
for (const record of overflow) {
  for (const defect of record.defects) {
    const key = `${defect.kind} | ${defect.element}`;
    const entry = offenders.get(key) ?? { kind: defect.kind, element: defect.element, projects: new Set(), states: new Set() };
    entry.projects.add(record.project);
    entry.states.add(record.state);
    offenders.set(key, entry);
  }
}

const axeByProject = projects.map((project) => {
  const own = a11y.filter((record) => record.project === project);
  return { project, states: own.length, blocking: own.reduce((sum, record) => sum + record.count, 0) };
});

const rules = new Map();
for (const record of a11y) {
  for (const violation of record.all ?? []) {
    const entry = rules.get(violation.rule) ?? { ...violation, nodes: 0, projects: new Set(), states: new Set(), examples: new Set() };
    entry.nodes += violation.nodes;
    entry.projects.add(record.project);
    entry.states.add(record.state);
    for (const example of violation.examples.slice(0, 2)) entry.examples.add(example);
    rules.set(violation.rule, entry);
  }
}
const impactOrder = ["critical", "serious", "moderate", "minor"];
const ruleList = [...rules.values()].sort((a, b) => impactOrder.indexOf(a.impact) - impactOrder.indexOf(b.impact) || b.nodes - a.nodes);
const contrastRules = ruleList.filter((rule) => rule.rule === "color-contrast");

// Token burn-down: what `check-tokens --strict` would fail on, by rule.
const strict = run("node", ["scripts/check-tokens.mjs", "--strict"]);
const burnDown = [...strict.stdout.matchAll(/^\s+(V\d)\s+(.+?)\s{2,}(\d+) errors?/gm)].map((match) => ({ rule: match[1], title: match[2].trim(), count: Number(match[3]) }));

// First-load bundle: what out/index.html actually loads.
function bundle() {
  const index = path.join(ROOT, "out", "index.html");
  if (!existsSync(index)) return null;
  const html = readFileSync(index, "utf8");
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]))];
  const measured = assets.map((asset) => {
    const bytes = readFileSync(path.join(ROOT, "out", asset));
    return { asset, kind: asset.endsWith(".css") ? "css" : "js", bytes: bytes.length, gzip: gzipSync(bytes).length };
  });
  const sum = (kind, field) => measured.filter((item) => kind === "all" || item.kind === kind).reduce((total, item) => total + item[field], 0);
  return {
    measured,
    js: { bytes: sum("js", "bytes"), gzip: sum("js", "gzip") },
    css: { bytes: sum("css", "bytes"), gzip: sum("css", "gzip") },
    total: { bytes: sum("all", "bytes"), gzip: sum("all", "gzip") },
  };
}
const size = bundle();

// ---------------------------------------------------------------- environment

const pkg = (name) => readJson(path.join(ROOT, "node_modules", name, "package.json")).version;
const git = (...args) => run("git", args).stdout.trim();
const chromium = (() => {
  try {
    const browsers = readJson(path.join(ROOT, "node_modules", "playwright-core", "browsers.json")).browsers;
    return browsers.find((browser) => browser.name === "chromium-headless-shell")?.browserVersion ?? "unknown";
  } catch {
    return "unknown";
  }
})();

// ---------------------------------------------------------------- report

const table = (header, rows) => [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
const list = (items, limit = 4) => [...items].slice(0, limit).join(", ") + (items.size > limit ? ", …" : "");

const totalOverflow = overflowByProject.reduce((sum, item) => sum + item.defects, 0);
const totalBlocking = axeByProject.reduce((sum, item) => sum + item.blocking, 0);
const burnTotal = burnDown.reduce((sum, item) => sum + item.count, 0);

const lines = [];
lines.push("# Baseline report: the legacy console, measured", "");
lines.push(
  "This is a dated measurement of the running console **before** the responsive-hardening phase. It is regenerated with `npm run build && npm run test:e2e && npm run baseline:report`; it is not a specification.",
  "",
);
lines.push(
  table(
    ["", ""],
    [
      ["Generated", new Date().toISOString().slice(0, 10)],
      ["Commit", `${git("rev-parse", "--short", "HEAD")}${git("status", "--porcelain") ? " plus uncommitted changes" : ""}`],
      ["Matrix", `${projects.length} projects (8 viewports, each light and dark) × ${states.length} states; e2e mode: baseline (defects recorded, not failed)`],
      ["Tooling", `Node ${process.versions.node} · Playwright ${pkg("@playwright/test")} · Chromium ${chromium} · axe-core ${pkg("axe-core")}`],
      ["App under test", "static export `out/` served by the mock engine (`e2e/mock-engine`), replaying real trace records"],
    ],
  ),
  "",
);

lines.push("## Summary", "");
lines.push(
  table(
    ["Check", "Result", "Meaning"],
    [
      ["Horizontal overflow (R4)", `**${totalOverflow}** defects`, `${overflow.length} page states checked; no page, scroll region or element widened past the viewport`],
      ["Accessibility, serious or critical (R5)", `**${totalBlocking}** defects in ${axeByProject.filter((item) => item.blocking > 0).length} of ${projects.length} projects`, `${ruleList.length} distinct axe rule(s) failed; see below`],
      ["Colour contrast (axe)", `**${contrastRules.length === 0 ? 0 : contrastRules.reduce((sum, rule) => sum + rule.nodes, 0)}** violations`, "axe reads the computed colours, so this tests the tokens as they render, in both themes"],
      ["Token burn-down (`check-tokens --strict`)", `**${burnTotal}** findings`, "what P12 has to remove before strict mode can pass"],
      ["First-load bundle", size ? `**${kb(size.total.gzip)}** gzip` : "not measured (no `out/`)", size ? `${kb(size.js.gzip)} JS + ${kb(size.css.gzip)} CSS` : "run `npm run build`"],
    ],
  ),
  "",
);

lines.push("## Horizontal overflow", "");
lines.push(table(["Project", "States checked", "Defects"], overflowByProject.map((item) => [item.project, item.states, item.defects])), "");
if (offenders.size === 0) {
  lines.push(
    "No offenders in any state. Read this with its limits: the fixtures hold no tables, code blocks or very long identifiers, which is where the static audit (LR-05) expected trouble. That worst case is covered separately by `e2e/prose.spec.ts`, which injects it into the real answer stylesheet and always enforces; and the responsive-hardening phase adds long-content stress states (P10-F06).",
    "",
  );
} else {
  lines.push(
    table(
      ["Offender", "Kind", "Projects", "States"],
      [...offenders.values()].map((entry) => [`\`${entry.element}\``, entry.kind, list(entry.projects), list(entry.states)]),
    ),
    "",
  );
}

lines.push("## Accessibility (axe-core, WCAG 2.2 A and AA)", "");
lines.push(table(["Project", "States checked", "Serious or critical"], axeByProject.map((item) => [item.project, item.states, item.blocking])), "");
if (ruleList.length === 0) {
  lines.push("No violations.", "");
} else {
  lines.push(
    table(
      ["Impact", "Rule", "What it means", "Nodes", "Projects", "States", "Example"],
      ruleList.map((rule) => [rule.impact, `\`${rule.rule}\``, rule.help, rule.nodes, rule.projects.size, list(rule.states), `\`${[...rule.examples][0] ?? ""}\``]),
    ),
    "",
  );
}

lines.push("## Token burn-down", "");
lines.push(
  "`node scripts/check-tokens.mjs --strict` ignores the baseline and counts every finding in the legacy code. The default gate passes because none of these may grow (`scripts/check-tokens.baseline.json`).",
  "",
  table(["Rule", "What", "Findings"], burnDown.map((item) => [item.rule, item.title, item.count])),
  "",
);

if (size) {
  lines.push("## First-load bundle", "");
  lines.push(
    table(
      ["Asset", "Raw", "Gzip"],
      [
        ...size.measured.map((item) => [`\`${item.asset.replace("/_next/static/", "")}\``, kb(item.bytes), kb(item.gzip)]),
        ["**Total**", `**${kb(size.total.bytes)}**`, `**${kb(size.total.gzip)}**`],
      ],
    ),
    "",
    "The budget for P12-F12 is this total plus 10 percent (`docs/baseline/bundle.json`).",
    "",
  );
}

const shots = [
  ["375-light", "turn-compound", "Phone, light: a compound answer"],
  ["375-dark", "turn-compound", "Phone, dark: the same answer"],
  ["375-light", "drawer-open", "Phone: the sessions drawer opens over the page with no backdrop (LR-03)"],
  ["1280-light", "turn-compound", "Desktop, light: three columns and the trace pane"],
  ["1280-dark", "turn-late-detail", "Desktop, dark: a late detail refines the answer"],
];
const copied = [];
for (const [project, state, caption] of shots) {
  const from = path.join(ROOT, "e2e", "__screenshots__", project, "visual.spec.ts", `${state}.png`);
  if (!existsSync(from)) continue;
  mkdirSync(SCREENS, { recursive: true });
  copyFileSync(from, path.join(SCREENS, `${project}-${state}.png`));
  copied.push([project, state, caption]);
}
if (copied.length > 0) {
  lines.push("## Screenshots", "");
  for (const [project, state, caption] of copied) lines.push(`**${caption}**`, "", `![${caption}](screens/${project}-${state}.png)`, "");
}

lines.push("## What this baseline does not cover", "");
lines.push(
  "- Only the states in `e2e/helpers/app.ts` are measured: the empty greeting, the replay bar, the test-case browser, four replayed scenarios (one with the trace timeline expanded) and, on phones, the sessions drawer.",
  "- The mock engine replays real trace records through a port of the engine's own AG-UI translator. Timing, evidence text and per-token pacing are reconstructed (see `e2e/fixtures/README.md`), so nothing here measures engine latency.",
  "- Keyboard journeys, screen-reader behaviour, forced-colours and reflow at 320 px are covered from P10 and P11.",
  "",
);

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "REPORT.md"), `${lines.join("\n")}\n`);
if (size) {
  writeFileSync(
    path.join(OUT, "bundle.json"),
    `${JSON.stringify({ measured: new Date().toISOString().slice(0, 10), gzipTotal: size.total.gzip, gzipJs: size.js.gzip, gzipCss: size.css.gzip, budgetGzip: Math.ceil(size.total.gzip * 1.1), assets: size.measured }, null, 2)}\n`,
  );
}
console.log(`baseline-report: wrote docs/baseline/REPORT.md (${overflow.length} overflow + ${a11y.length} accessibility records, ${projects.length} projects)`);
