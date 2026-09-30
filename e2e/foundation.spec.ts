import { expect, test } from "@playwright/test";
import { schemeOf, waitForHydration } from "./helpers/app";

/*
 * Phase 1 acceptance, in a real browser: the stored theme is applied before the
 * page is parsed to its end (so nothing flashes), the theme-color meta follows the
 * --chrome token, and keyboard focus draws the token ring. These always enforce.
 */

interface Probe {
  __attributeAtDcl?: string | null;
}

const CANVAS = { light: "rgb(244, 246, 249)", dark: "rgb(15, 23, 42)" } as const;
const CHROME = { light: "#0c2340", dark: "#071527" } as const;
const RING = { light: "rgb(20, 40, 160)", dark: "rgb(142, 156, 241)" } as const;

test.describe("theme boot", () => {
  // The result does not depend on the viewport, so one project is enough.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "1280-light", "viewport-independent; one project is enough");
  });

  const cases = [
    { stored: "dark", os: "light", shows: "dark" },
    { stored: "light", os: "dark", shows: "light" },
    { stored: "system", os: "dark", shows: "dark" },
    { stored: "system", os: "light", shows: "light" },
  ] as const;

  for (const { stored, os, shows } of cases) {
    test(`a stored "${stored}" choice on a ${os} system shows ${shows}, before hydration`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: os });
      await page.addInitScript((value) => {
        window.localStorage.setItem("slr.theme", value);
        document.addEventListener("DOMContentLoaded", () => {
          (window as unknown as Probe).__attributeAtDcl = document.documentElement.getAttribute("data-theme");
        });
      }, stored);
      await page.goto("/");

      // At DOMContentLoaded React has not hydrated yet: this is the boot script's doing alone.
      expect(await page.evaluate(() => (window as unknown as Probe).__attributeAtDcl)).toBe(stored === "system" ? null : stored);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(CANVAS[shows]);
    });
  }

  test("theme-color follows the --chrome token in both themes", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((value) => window.localStorage.setItem("slr.theme", value), theme);
      await page.goto("/");
      const meta = page.locator('meta[name="theme-color"]');
      await expect(meta).toHaveAttribute("content", CHROME[theme]);
      const chrome = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--chrome").trim());
      expect(chrome).toBe(CHROME[theme]);
    }
  });

  test("carries no colour literal in the boot script or the viewport", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).not.toMatch(/name="theme-color"[^>]*media=/);
    expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("viewport-fit=cover");
    expect(await page.locator('meta[name="color-scheme"]').getAttribute("content")).toBe("light dark");
  });
});

test.describe("keyboard focus", () => {
  test("draws the token focus ring: 2px, solid, offset 2px", async ({ page }, testInfo) => {
    await page.addInitScript((value) => window.localStorage.setItem("slr.theme", value), schemeOf(testInfo));
    await page.goto("/");
    await waitForHydration(page);
    await page.evaluate(() => {
      const probe = document.createElement("button");
      probe.id = "focus-probe";
      probe.textContent = "probe";
      document.body.prepend(probe);
    });
    await page.keyboard.press("Tab");
    // Reduced motion gives every property a 0.01 ms transition (base.css), and a computed
    // style read in the frame of the change can still be the transition's start value.
    // Wait two frames so the read is of the settled state.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const ring = await page.locator("#focus-probe").evaluate((element) => {
      const style = getComputedStyle(element);
      return { focused: document.activeElement === element, style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor, offset: style.outlineOffset };
    });
    expect(ring).toEqual({ focused: true, style: "solid", width: "2px", colour: RING[schemeOf(testInfo)], offset: "2px" });
  });
});
