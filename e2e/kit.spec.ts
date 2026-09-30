import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { schemeOf, waitForHydration, widthOf } from "./helpers/app";
import { expectClean } from "./helpers/clean";
import { findOverflow } from "./helpers/overflow";
import { appUrl } from "./helpers/urls";

/*
 * Phase 3 gate. The design kit is new code, so nothing here is baseline-only: every
 * check enforces. The kit is measured in every state a person can put it in (closed,
 * and with each floating layer open), at eight viewports in both themes: no horizontal
 * scrollbar (R4) and no serious or critical WCAG 2.2 A/AA violation (R5).
 */

async function openKit(page: Page, testInfo: TestInfo): Promise<void> {
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
  await page.goto(appUrl("kit", "/kit/"));
  await waitForHydration(page);
  await expect(page.getByRole("heading", { name: "Design kit", level: 1 })).toBeVisible();
}

const narrow = (testInfo: TestInfo) => widthOf(testInfo) < 480;

test.describe("the kit page", () => {
  test("closed: no overflow, no serious or critical violation", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await expectClean(page, "kit");
  });

  test("every section is there, each a landmark named by its heading", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    for (const name of ["Colour", "Type", "Buttons", "Form controls", "Tabs", "Data table", "Readouts, meters and charts", "JSON and code", "States"]) {
      await expect(page.getByRole("region", { name, exact: false }).first()).toBeAttached();
    }
    for (const state of ["Empty", "Loading", "Streaming", "Error", "Degraded", "Cancelled", "Offline"]) {
      await expect(page.locator("#states").getByRole("region", { name: state, exact: true })).toBeAttached();
    }
  });
});

test.describe("floating layers, open", () => {
  test("a tooltip", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.getByRole("button", { name: "Hover or focus me" }).hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await expectClean(page, "tooltip");
  });

  test("a menu", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("menu", { name: "Turn actions" })).toBeVisible();
    await expectClean(page, "menu");
  });

  test("a menu at the edge of the screen stays on the screen", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.getByRole("button", { name: "Edge menu" }).click();
    const menu = page.getByRole("menu", { name: "Edge actions" });
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
    await expectClean(page, "edge menu");
  });

  test("a popover", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await expectClean(page, "popover");
  });

  test("a right sheet, then the page behind it is inert and Escape gives focus back", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const opener = page.getByRole("button", { name: "Open right sheet" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Turn t3" });
    await expect(dialog).toBeVisible();
    await expectClean(page, "right sheet");

    // The panel is never wider than the screen.
    const box = await dialog.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);
    expect(box?.width ?? 0).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a bottom sheet", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.getByRole("button", { name: "Open bottom sheet" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await expectClean(page, "bottom sheet");
  });

  test("a toast with a long unbroken URL", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.getByRole("button", { name: "Error with a long URL" }).click();
    await expect(page.getByRole("region", { name: "Notifications" })).toBeVisible();
    await expectClean(page, "toast");
  });
});

test.describe("acceptance cases from PHASES.md", () => {
  test("P3-F03: a 60-character badge never widens the page, and a longer one is cut off with an ellipsis", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const sixty = page.getByText("A label that is deliberately sixty characters long, no fewer!").first();
    await sixty.scrollIntoViewIfNeeded();
    const box = await sixty.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // About 125 characters: wider than any phone or tablet container, so it must be clipped.
    const long = page.getByText("A label of about a hundred and twenty characters").first();
    if (widthOf(testInfo) < 768) {
      const cut = await long.evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(cut, "the truncated badge shows an ellipsis").toBe(true);
      expect(await long.evaluate((element) => getComputedStyle(element).textOverflow)).toBe("ellipsis");
    }
    const wrapped = page.getByText("A label of about a hundred and twenty characters").nth(1);
    expect(await wrapped.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });

  test("P3-F08: six tabs collapse into a More menu when they do not fit, and never scroll sideways", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const list = page.getByRole("tablist", { name: "Six sections" });
    await list.scrollIntoViewIfNeeded();
    const more = page.getByRole("button", { name: "More" }).first();
    // Wait for the measuring pass to settle: either everything fits or More has appeared.
    await expect.poll(async () => (await list.getByRole("tab").count()) + (await more.isVisible() ? 100 : 0)).toBeGreaterThan(0);
    const fits = await page.evaluate(() => {
      const tabs = document.querySelector('[role="tablist"][aria-label="Six sections"]');
      return tabs ? tabs.scrollWidth <= tabs.clientWidth + 1 : false;
    });
    expect(fits, "the tab row holds nothing wider than itself").toBe(true);
    if (narrow(testInfo)) {
      await expect(page.getByRole("tablist", { name: "Six sections" }).locator("xpath=..").getByRole("button", { name: "More" })).toBeVisible();
      expect(await list.getByRole("tab").count()).toBeLessThan(6);
    } else if (widthOf(testInfo) >= 1024) {
      expect(await list.getByRole("tab").count()).toBe(6);
    }
    await expectClean(page, "six tabs");
  });

  test("P3-F19: the eight-column table adapts to the width of its own container, down to records", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const table = page.getByRole("grid", { name: "Turns", exact: true });
    await table.scrollIntoViewIfNeeded();
    const width = await page.evaluate(() => (document.querySelector(".dt") as HTMLElement).getBoundingClientRect().width);

    const visibleHeaders = await table.getByRole("columnheader").evaluateAll((headers) => headers.filter((header) => getComputedStyle(header).display !== "none").length);
    // Cell 0 is the checkbox, cell 1 the turn id, cell 2 the utterance.
    const firstCell = table.getByRole("row").nth(1).getByRole("gridcell").nth(2);
    const display = await firstCell.evaluate((cell) => getComputedStyle(cell).display);

    // Eight columns and a checkbox column: 9 headers when nothing is dropped.
    if (width >= 960) expect(visibleHeaders).toBe(9);
    else if (width >= 720) expect(visibleHeaders).toBe(7);
    else if (width >= 480) expect(visibleHeaders).toBe(5);
    if (width < 480) {
      expect(display, `a ${Math.round(width)} px container shows records`).toBe("grid");
      const label = await firstCell.evaluate((cell) => getComputedStyle(cell, "::before").content);
      expect(label).toContain("Utterance");
    } else {
      expect(display).toBe("table-cell");
    }
    expect(await findOverflow(page), "the table causes no overflow").toEqual([]);
  });

  test("P3-F22: a 500-character string and an unbroken token wrap inside the viewer", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const tree = page.getByRole("tree", { name: "Trace record t3" });
    await tree.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Expand all" }).click();
    const long = tree.getByRole("treeitem").filter({ hasText: "unbroken" });
    await expect(long).toBeVisible();
    const fits = await tree.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(fits).toBe(true);
    const box = await long.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);
    expect(await findOverflow(page)).toEqual([]);
  });

  test("P3-F15: the spinner is the one thing that rotates, and reduced motion stops it", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const ring = page.locator("[role=status] .animate-spin").first();
    await ring.scrollIntoViewIfNeeded();
    const style = await ring.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { name: computed.animationName, duration: Number.parseFloat(computed.animationDuration), count: computed.animationIterationCount };
    });
    expect(style.name).toBe("spin");
    // reducedMotion: "reduce" is set for every project: base.css shortens it to 0.01 ms, once.
    expect(style.duration).toBeLessThan(0.001);
    expect(style.count).toBe("1");
  });

  test("P3-F18: the skip link is the first tab stop, appears when focused, and moves focus to the content", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(8);
    await page.keyboard.press("Enter");
    await expect(page.locator("#kit-main")).toBeFocused();
  });

  test("P3-F07: a tooltip opens on keyboard focus and Escape closes it", async ({ page }, testInfo) => {
    await openKit(page, testInfo);
    const trigger = page.getByRole("button", { name: "Hover or focus me" });
    await trigger.scrollIntoViewIfNeeded();
    await page.keyboard.press("Tab");
    // Tab until the trigger has focus: the kit has many controls before it.
    for (let step = 0; step < 120 && !(await trigger.evaluate((element) => element === document.activeElement)); step += 1) await page.keyboard.press("Tab");
    await expect(page.getByRole("tooltip")).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-describedby", /.+/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("touch targets (P3, definition of done: 44 px on a coarse pointer)", () => {
  test("every button, tab, radio and switch row is at least 44 px tall on a touch screen", async ({ page }, testInfo) => {
    test.skip(widthOf(testInfo) >= 768, "coarse pointers are emulated on the phone sizes");
    await openKit(page, testInfo);
    const small = await page.evaluate(() => {
      const found: { what: string; height: number; width: number }[] = [];
      const selector = 'main button, main [role="tab"], main [role="radio"], main label:has(input[type="checkbox"])';
      const seen = new Set<Element>();
      for (const found_ of document.querySelectorAll<HTMLElement>(selector)) {
        // A switch is a small button inside a row that is the target.
        const element = found_.matches('[role="switch"]') ? (found_.closest("label") ?? found_) : found_;
        if (seen.has(element)) continue;
        seen.add(element);
        if (element.closest("[inert], [aria-hidden='true']")) continue;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (box.height < 43.5) found.push({ what: (element.getAttribute("aria-label") ?? element.textContent ?? element.tagName).trim().slice(0, 40), height: Math.round(box.height), width: Math.round(box.width) });
      }
      return found;
    });
    expect(small).toEqual([]);
  });
});
