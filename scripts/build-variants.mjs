#!/usr/bin/env node
/**
 * Builds the static export in the variants the end-to-end tests need, each into its
 * own folder so they can be served side by side:
 *
 *   app     out/          what `npm run build` makes: the new shell, no design kit
 *   legacy  out-legacy/   NEXT_PUBLIC_LEGACY_SHELL=1: the previous three-column shell
 *   kit     out-kit/      NEXT_PUBLIC_KIT=1: the app plus the /kit design page
 *
 *   node scripts/build-variants.mjs            all three
 *   node scripts/build-variants.mjs kit legacy only those
 *
 * The flags are inlined at build time, which is why one build cannot serve both.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const VARIANTS = [
  { name: "app", dir: "out", env: {} },
  { name: "legacy", dir: "out-legacy", env: { NEXT_PUBLIC_LEGACY_SHELL: "1", NEXT_DIST_DIR: "out-legacy" } },
  { name: "kit", dir: "out-kit", env: { NEXT_PUBLIC_KIT: "1", NEXT_DIST_DIR: "out-kit" } },
];

const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !VARIANTS.some((variant) => variant.name === name));
if (unknown.length > 0) {
  console.error(`build-variants: unknown variant ${unknown.join(", ")}. Choose from ${VARIANTS.map((variant) => variant.name).join(", ")}.`);
  process.exit(1);
}

for (const variant of VARIANTS.filter((candidate) => wanted.length === 0 || wanted.includes(candidate.name))) {
  console.log(`\nbuild-variants: ${variant.name} -> ${variant.dir}/`);
  rmSync(variant.dir, { recursive: true, force: true });
  const built = spawnSync("npx", ["next", "build"], { stdio: "inherit", env: { ...process.env, ...variant.env } });
  if (built.status !== 0) {
    console.error(`build-variants: the ${variant.name} build failed`);
    process.exit(built.status ?? 1);
  }
}
console.log("\nbuild-variants: done");
