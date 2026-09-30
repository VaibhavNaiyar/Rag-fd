import { defineConfig } from "@playwright/test";
import { FOLDERS, PORTS, VARIANTS } from "./e2e/helpers/urls";

/*
 * The responsive and accessibility matrix: eight viewports, each in light and dark.
 * 375 x 667 is the floor (PHASES.md R4); the rest cover phones, tablets and desktops.
 *
 * The app under test is a static export, served by the mock engine on one origin,
 * exactly as the engine serves it in production. Three builds are served side by side
 * (`npm run build:e2e` makes them): the app, the previous shell, and the app with the
 * /kit design page. A spec picks its build with appUrl(variant, path). `hasTouch` on the
 * phone sizes makes `(pointer: coarse)` match.
 *
 * E2E_MODE=baseline (the default) records defects to e2e/.cache/baseline without
 * failing; E2E_MODE=enforce fails on them. The previous shell is measured in baseline
 * mode; new code (the kit, the new shell) always enforces.
 */
const VIEWPORTS = [
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

const SCHEMES = ["light", "dark"] as const;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" },
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORTS.app}`,
    trace: "retain-on-failure",
    reducedMotion: "reduce",
    locale: "en-GB",
    timezoneId: "UTC",
    deviceScaleFactor: 1,
  },
  projects: VIEWPORTS.flatMap((viewport) =>
    SCHEMES.map((scheme) => ({
      name: `${viewport.name}-${scheme}`,
      use: {
        browserName: "chromium" as const,
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
        isMobile: viewport.width < 768,
        hasTouch: viewport.width < 768,
      },
    })),
  ),
  webServer: VARIANTS.map((variant) => ({
    command: `node e2e/mock-engine/server.mjs --port ${PORTS[variant]} --static ${FOLDERS[variant]}`,
    url: `http://127.0.0.1:${PORTS[variant]}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { MOCK_NOW: "1790000000000" },
  })),
});
