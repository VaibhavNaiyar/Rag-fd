import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { appUrl } from "./urls";

/**
 * "baseline" records what is wrong without failing, so the legacy UI can be
 * measured (docs/baseline/REPORT.md). "enforce" fails on any defect: it is what
 * the responsive-hardening phase turns on.
 */
export const MODE: "baseline" | "enforce" = process.env.E2E_MODE === "enforce" ? "enforce" : "baseline";

export const BASELINE_DIR = path.resolve("e2e", ".cache", "baseline");

export type Scheme = "light" | "dark";
export const schemeOf = (testInfo: TestInfo): Scheme => (testInfo.project.use.colorScheme === "dark" ? "dark" : "light");
export const widthOf = (testInfo: TestInfo): number => testInfo.project.use.viewport?.width ?? 0;

/** The labels of the four featured test cases the legacy greeting offers, in the order of its replay keys 1-4. */
export const FEATURED = {
  compound: "Compound multi-intent request",
  lateDetail: "Late-arriving detail",
  suppression: "Presentation-only turn",
  unanswerable: "Outside the corpus",
} as const;

export interface ConsoleState {
  /** Used in file names and test titles. */
  name: string;
  /** Opens `/?replay=1`, which reveals the replay bar. */
  replay?: boolean;
  /** Only meaningful below this viewport width (a state that needs the phone layout). */
  below?: number;
  /** Drives the page from the greeting to the state. */
  run: (page: Page) => Promise<void>;
}

/** Resolves once React has taken over the page (layout.tsx sets the attribute), so a click never lands on markup without handlers. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForSelector('html[data-hydrated="true"]', { state: "attached" });
}

/** Runs one of the featured fixtures from the greeting, in the mock engine, and waits for the page to go quiet. */
async function replayFeatured(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label }).first().click();
  await settle(page);
}

/** Every state of the legacy console that the matrix looks at. New views add their own in later phases. */
export const STATES: ConsoleState[] = [
  { name: "empty", run: async () => {} },
  { name: "replay-bar", replay: true, run: async () => {} },
  {
    name: "fixtures-open",
    run: async (page) => {
      await page.getByText(/Browse all \d+ test cases/).click();
    },
  },
  { name: "turn-compound", run: (page) => replayFeatured(page, FEATURED.compound) },
  {
    name: "turn-compound-trace",
    run: async (page) => {
      await replayFeatured(page, FEATURED.compound);
      await page.locator("button[aria-expanded]").first().click();
    },
  },
  { name: "turn-late-detail", run: (page) => replayFeatured(page, FEATURED.lateDetail) },
  { name: "turn-suppressed", run: (page) => replayFeatured(page, FEATURED.suppression) },
  { name: "turn-unanswerable", run: (page) => replayFeatured(page, FEATURED.unanswerable) },
  {
    name: "drawer-open",
    below: 768,
    run: async (page) => {
      await page.getByRole("button", { name: "Show sessions" }).click();
    },
  },
];

/** Resolves once the page has stopped changing for 300 ms (or after 8 s). Frames from the mock engine arrive at once. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let timer = window.setTimeout(done, 300);
        const observer = new MutationObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(done, 300);
        });
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        window.setTimeout(done, 8000);
        function done() {
          observer.disconnect();
          resolve();
        }
      }),
  );
}

/**
 * Opens the previous console (the legacy build) in a state, in the project's colour scheme. The theme is set
 * through the app's own storage key, which its pre-paint script reads, so a dark
 * project really renders the dark theme rather than merely preferring it.
 */
export async function openState(page: Page, testInfo: TestInfo, state: ConsoleState): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // storage blocked: the default (light) applies
      }
    },
    ["slr.theme", schemeOf(testInfo)] as const,
  );
  await page.goto(appUrl("legacy", state.replay ? "/?replay=1" : "/"));
  await waitForHydration(page);
  await expect(page.getByText("Engine live")).toBeVisible();
  await state.run(page);
  await settle(page);
}

export interface Defect {
  [key: string]: unknown;
}

/**
 * Records the defects a check found. In baseline mode they are written to
 * e2e/.cache/baseline (for scripts/baseline-report.mjs) and attached to the test;
 * in enforce mode any defect fails the test.
 */
export async function recordDefects(testInfo: TestInfo, kind: string, state: string, defects: Defect[], extra: Record<string, unknown> = {}): Promise<void> {
  const record = { project: testInfo.project.name, kind, state, count: defects.length, defects, ...extra };
  const directory = path.join(BASELINE_DIR, testInfo.project.name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${kind}__${state}.json`), `${JSON.stringify(record, null, 2)}\n`);
  await testInfo.attach(`${kind}-${state}.json`, { body: JSON.stringify(record, null, 2), contentType: "application/json" });
  testInfo.annotations.push({ type: kind, description: `${defects.length} defect(s)` });
  if (MODE === "enforce") expect(defects, `${kind} defects in state "${state}"`).toEqual([]);
}
