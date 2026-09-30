import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { BASELINE_DIR } from "./helpers/app";
import { FOLDERS, VARIANTS } from "./helpers/urls";

/**
 * Each run starts with an empty defect record, so a renamed state cannot leave a stale
 * file behind, and it refuses to start against a build that is not there: a missing
 * folder would otherwise show up as forty confusing "page not found" failures.
 */
export default function globalSetup(): void {
  rmSync(BASELINE_DIR, { recursive: true, force: true });

  const missing = VARIANTS.filter((variant) => !existsSync(path.resolve(FOLDERS[variant], "index.html")));
  if (missing.length > 0) {
    throw new Error(`No build to test for: ${missing.map((variant) => `${variant} (${FOLDERS[variant]}/)`).join(", ")}. Run \`npm run build:e2e\` first.`);
  }
}
