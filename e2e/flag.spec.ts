import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/app";
import { appUrl } from "./helpers/urls";

/*
 * P4-F17 and the gate line "the flag toggles old and new shell". The flag is read when
 * the app is built, so the two shells are two builds, served side by side. The design kit
 * is a route only in a build made for it.
 */

test.describe("the shell flag", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "1280-light", "a property of the builds, not of a viewport");
  });

  test("the default build is the new frame, with none of the old shell", async ({ page }) => {
    await page.goto(appUrl("app", "/"));
    await waitForHydration(page);
    await expect(page.locator(".frame")).toHaveCount(1);
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Views" })).toBeVisible();
  });

  test("the legacy build (NEXT_PUBLIC_LEGACY_SHELL=1) is the previous three-column shell, with none of the new frame", async ({ page }) => {
    await page.goto(appUrl("legacy", "/"));
    await waitForHydration(page);
    await expect(page.locator(".app-shell")).toHaveCount(1);
    await expect(page.locator(".frame")).toHaveCount(0);
    await expect(page.getByText("Engine live")).toBeVisible();
  });

  test("both shells work: each replays a turn from its greeting", async ({ page }) => {
    for (const variant of ["app", "legacy"] as const) {
      await page.goto(appUrl(variant, "/"));
      await waitForHydration(page);
      await page.getByRole("button", { name: "Compound multi-intent request" }).first().click();
      await expect(page.getByText(/Ran \d+ searches/)).toBeVisible();
    }
  });
});

test.describe("the design kit", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "1280-light", "a property of the builds, not of a viewport");
  });

  test("is a route in the kit build", async ({ page }) => {
    const response = await page.goto(appUrl("kit", "/kit/"));
    expect(response?.status()).toBe(200);
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Design kit", level: 1 })).toBeVisible();
  });

  test("is not in the production build, or the legacy build: those routes do not exist", async ({ page }) => {
    for (const variant of ["app", "legacy"] as const) {
      const response = await page.goto(appUrl(variant, "/kit/"));
      expect(response?.status(), `${variant} build`).toBe(404);
      await expect(page.getByRole("heading", { name: "Design kit" })).toHaveCount(0);
    }
  });

  test("leaves no trace of the kit in the production export", async ({ request }) => {
    const home = await request.get(appUrl("app", "/"));
    expect(await home.text()).not.toContain("Design kit");
  });
});
