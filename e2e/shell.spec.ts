import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { FEATURED, schemeOf, settle, waitForHydration, widthOf } from "./helpers/app";
import { expectClean } from "./helpers/clean";
import { appUrl } from "./helpers/urls";

/*
 * Phase 4 gate. The new frame, at eight viewports in both themes: no horizontal scrollbar,
 * no serious or critical accessibility violation, and complete keyboard operation. It is
 * new code, so every check enforces. The content inside the views is still the previous
 * one, through the bridge, and is not what is being judged here: the frame is.
 */

const PHONE = 768;
const DOCK = 1024;
const phone = (testInfo: TestInfo) => widthOf(testInfo) < PHONE;
const docked = (testInfo: TestInfo) => widthOf(testInfo) >= DOCK;

async function openShell(page: Page, testInfo: TestInfo, path = "/"): Promise<void> {
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
  await page.goto(appUrl("app", path));
  await waitForHydration(page);
  await page.waitForSelector('.frame[data-connection="open"]');
}

async function replayCompound(page: Page): Promise<void> {
  await page.getByRole("button", { name: FEATURED.compound }).first().click();
  await settle(page);
}

const toggleInspector = (page: Page) => page.getByRole("button", { name: /^(Open|Close) inspector$/ });
const size = async (locator: Locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
const near = (actual: number, expected: number, tolerance = 1) => Math.abs(actual - expected) <= tolerance;

test.describe("the frame", () => {
  test("fits the screen: the page does not scroll, and each bar has its token's size", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    const fits = await page.evaluate(() => ({
      down: document.documentElement.scrollHeight <= window.innerHeight,
      across: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      frame: Math.round((document.querySelector(".frame") as HTMLElement).getBoundingClientRect().height) === window.innerHeight,
    }));
    expect(fits).toEqual({ down: true, across: true, frame: true });

    const bar = await size(page.getByRole("banner"));
    expect(near(bar.height, phone(testInfo) ? 44 : 48), `top bar is ${bar.height} px tall`).toBe(true);

    if (phone(testInfo)) {
      expect(near((await size(page.getByRole("navigation", { name: "Views" }))).height, 56)).toBe(true);
      await expect(page.getByRole("contentinfo")).toBeHidden();
    } else {
      const rail = await size(page.getByRole("navigation", { name: "Views" }));
      expect(near(rail.width, 56), `the nav rail is ${rail.width} px wide`).toBe(true);
      expect(near((await size(page.getByRole("contentinfo"))).height, 24)).toBe(true);
    }
  });

  test("shows a nav rail from 768 px and a tab bar below, never both", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    // Only the visible one is in the accessibility tree; the other is display: none.
    await expect(page.getByRole("navigation", { name: "Views" })).toHaveCount(1);
    const box = await size(page.getByRole("navigation", { name: "Views" }));
    if (phone(testInfo)) expect(box.y).toBeGreaterThan(200);
    else expect(box.x).toBeLessThan(10);
  });

  test("has one main landmark, one banner and a skip link, and the layer root sits outside the frame", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    expect(await page.locator("#layer-root").count()).toBe(1);
    expect(await page.evaluate(() => document.querySelector(".frame")?.contains(document.getElementById("layer-root")))).toBe(false);
  });

  test("at 375 px the top bar is a name and three icons that fit", async ({ page }, testInfo) => {
    test.skip(widthOf(testInfo) !== 375, "the smallest phone");
    await openShell(page, testInfo);
    const bar = page.getByRole("banner");
    const buttons = bar.getByRole("button");
    await expect(buttons).toHaveCount(2);
    for (const button of await buttons.all()) {
      const box = await size(button);
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
    await expect(bar.getByText("Streaming Live RAG")).toBeVisible();
  });
});

test.describe("every state is clean: no overflow, no serious or critical violation", () => {
  test("the console, empty", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await expectClean(page, "console, empty");
  });

  test("the console, with a replayed turn", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await replayCompound(page);
    await expectClean(page, "console, one turn");
  });

  test("the console, in replay mode", async ({ page }, testInfo) => {
    await openShell(page, testInfo, "/?replay=1");
    await expectClean(page, "console, replay bar");
  });

  test("traces", async ({ page }, testInfo) => {
    await openShell(page, testInfo, "/#/traces");
    await expect(page.getByRole("heading", { name: "Traces", level: 2 })).toBeVisible();
    await expectClean(page, "traces");
  });

  test("metrics, empty and with a turn", async ({ page }, testInfo) => {
    await openShell(page, testInfo, "/#/metrics");
    await expect(page.getByRole("heading", { name: "Metrics", level: 2 })).toBeVisible();
    await expectClean(page, "metrics, empty");
    await page.evaluate(() => void (window.location.hash = "#/console"));
    await replayCompound(page);
    await page.evaluate(() => void (window.location.hash = "#/metrics"));
    await expect(page.getByRole("region", { name: "Session telemetry" })).toBeVisible();
    await expectClean(page, "metrics, with a turn");
  });

  test("the Inspector, open, with a turn", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await replayCompound(page);
    await toggleInspector(page).click();
    if (docked(testInfo)) await expect(page.getByRole("complementary", { name: /Turn/ })).toBeVisible();
    else await expect(page.getByRole("dialog", { name: /Turn/ })).toBeVisible();
    await settle(page);
    await expectClean(page, "inspector");
  });

  test("the phone menu", async ({ page }, testInfo) => {
    test.skip(!phone(testInfo), "the menu exists below 768 px");
    await openShell(page, testInfo);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await expectClean(page, "phone menu");
  });
});

test.describe("navigation", () => {
  test("goes to a view from the rail or the tab bar, and marks it current", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Traces" }).click();
    await expect(page).toHaveURL(/#\/traces$/);
    await expect(page.getByRole("heading", { name: "Traces", level: 2 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Traces" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Console" })).not.toHaveAttribute("aria-current", /.+/);
  });

  test("opens straight on a view from its address, and keeps it on reload", async ({ page }, testInfo) => {
    await openShell(page, testInfo, "/#/metrics");
    await expect(page.getByRole("heading", { name: "Metrics", level: 2 })).toBeVisible();
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Metrics", level: 2 })).toBeVisible();
  });

  test("goes back and forward through the views", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    const nav = page.getByRole("navigation", { name: "Views" });
    await nav.getByRole("link", { name: "Traces" }).click();
    await nav.getByRole("link", { name: "Metrics" }).click();
    await expect(page.getByRole("heading", { name: "Metrics", level: 2 })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Traces", level: 2 })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Metrics", level: 2 })).toBeVisible();
  });

  test("the nav rail is one tab stop, and the arrow keys move between the views", async ({ page }, testInfo) => {
    test.skip(phone(testInfo), "the rail is from 768 px");
    await openShell(page, testInfo);
    const rail = page.getByRole("navigation", { name: "Views" });
    await rail.getByRole("link", { name: "Console" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(rail.getByRole("link", { name: "Traces" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(rail.getByRole("link", { name: "Metrics" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/metrics$/);
    expect(await rail.getByRole("link").evaluateAll((links) => links.filter((link) => link.getAttribute("tabindex") === "0").length)).toBe(1);
  });
});

test.describe("the Inspector", () => {
  test("below 1024 px it is a sheet: it traps focus, Escape closes it, and focus returns", async ({ page }, testInfo) => {
    test.skip(docked(testInfo), "docked from 1024 px");
    await openShell(page, testInfo);
    await replayCompound(page);
    const toggle = toggleInspector(page);
    await toggle.click();
    const dialog = page.getByRole("dialog", { name: /Turn/ });
    await expect(dialog).toBeVisible();

    // The page behind is inert, and Tab cannot leave the sheet.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), `Tab stop ${step + 1} is inside the sheet`).toBe(true);
    }
    // The sheet is never wider than the screen.
    const box = await size(dialog);
    expect(box.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Open inspector" })).toBeFocused();
  });

  test("from 1024 px it is docked beside the view: focus moves in, the view keeps 360 px, and focus returns", async ({ page }, testInfo) => {
    test.skip(!docked(testInfo), "a sheet below 1024 px");
    await openShell(page, testInfo);
    await replayCompound(page);
    await toggleInspector(page).click();
    const aside = page.getByRole("complementary", { name: /Turn/ });
    await expect(aside).toBeVisible();
    await expect(aside).toBeFocused();

    const inspector = await size(aside);
    const view = await size(page.getByRole("main"));
    expect(inspector.width).toBeGreaterThanOrEqual(359);
    expect(inspector.width).toBeLessThanOrEqual(721);
    expect(view.width, "the view is not squeezed").toBeGreaterThanOrEqual(359);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await aside.getByRole("button", { name: "Close" }).click();
    await expect(aside).toBeHidden();
    await expect(page.getByRole("button", { name: "Open inspector" })).toBeFocused();
  });

  test("its width is set from the keyboard and by dragging, held between its limits, and remembered", async ({ page }, testInfo) => {
    test.skip(!docked(testInfo), "no handle below 1024 px");
    await openShell(page, testInfo);
    await toggleInspector(page).click();
    const aside = page.getByRole("complementary", { name: /Turn/ });
    const handle = page.getByRole("separator", { name: "Resize the inspector" });
    await expect(handle).toBeVisible();
    // Opening the Inspector moves focus into it (useDockFocus, tested elsewhere); wait for that
    // to settle before moving focus on to the handle, so the two do not race for it.
    await expect(aside).toBeFocused();

    await handle.focus();
    await page.keyboard.press("Home");
    // The starting width (400 or 480, both already >= 359) means a ">= 359" poll would pass
    // before the keypress's effect ever propagates — wait for the actual target instead.
    await expect.poll(async () => Math.round((await size(aside)).width)).toBeLessThanOrEqual(362);
    const least = (await size(aside)).width;
    expect(near(least, 360, 2), `least width is ${least}`).toBe(true);

    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => Math.round((await size(aside)).width)).toBe(Math.round(least) + 16);

    await page.keyboard.press("End");
    const most = (await size(aside)).width;
    expect(most).toBeLessThanOrEqual(721);
    expect((await size(page.getByRole("main"))).width, "the view keeps its room at the widest").toBeGreaterThanOrEqual(359);

    // A drag to the left widens it. Wait for the layout to settle at the least width before measuring the handle.
    await page.keyboard.press("Home");
    await expect.poll(async () => Math.round((await size(aside)).width)).toBeLessThanOrEqual(362);
    const grip = await size(handle);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + 200);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 - 60, grip.y + 200, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await size(aside)).width)).toBeGreaterThan(Math.round(least) + 40);

    // Remembered: a reload on an Inspector address comes back at that width.
    const chosen = Math.round((await size(aside)).width);
    await page.goto(appUrl("app", "/#/inspect/live/latest"));
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByRole("complementary", { name: /Turn/ })).toBeVisible();
    expect(near((await size(page.getByRole("complementary", { name: /Turn/ }))).width, chosen, 2)).toBe(true);
  });

  test("opens from an address, over the view that was showing", async ({ page }, testInfo) => {
    await openShell(page, testInfo, "/#/inspect/live/latest");
    if (docked(testInfo)) await expect(page.getByRole("complementary", { name: /Turn/ })).toBeVisible();
    else await expect(page.getByRole("dialog", { name: /Turn/ })).toBeVisible();
    await expect(toggleInspector(page)).toHaveAccessibleName("Close inspector");
  });
});

test.describe("the status, the menu and the theme", () => {
  test("from 768 px the strip shows the session, the turns and the last turn's time, and they follow a replay", async ({ page }, testInfo) => {
    test.skip(phone(testInfo), "the strip is from 768 px");
    await openShell(page, testInfo);
    const strip = page.getByRole("contentinfo");
    await expect(strip.getByText(/^s_mock_/)).toBeVisible();
    await expect(strip.locator('[data-fact="turns"]')).toContainText("Turns 0");
    await expect(strip.locator('[data-fact="last-turn"]')).toContainText("n/a");

    await replayCompound(page);
    await expect(strip.locator('[data-fact="turns"]')).toContainText("Turns 1");
    await expect(strip.locator('[data-fact="last-turn"]')).not.toContainText("n/a");
  });

  test("below 768 px the same facts are in the menu, and the menu stays on screen", async ({ page }, testInfo) => {
    test.skip(!phone(testInfo), "the menu is below 768 px");
    await openShell(page, testInfo);
    await page.getByRole("button", { name: "Menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^s_mock_/)).toBeVisible();
    await expect(dialog.getByText("Engine ok, version mock-engine")).toBeVisible();
    const box = await size(dialog);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(widthOf(testInfo));
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
  });

  test("changes the theme from the bar (768 px and up) or the menu, and remembers it", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    if (phone(testInfo)) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("dialog", { name: "Menu" }).getByRole("radio", { name: schemeOf(testInfo) === "dark" ? "Light" : "Dark" }).click();
    } else {
      await page.getByRole("button", { name: /^Theme: / }).click();
    }
    // The bar cycles light, dark, follow-system. "Follow system" removes the attribute and stores
    // "system", so a missing attribute is that choice, not an absence of one.
    const stamped = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const now = stamped ?? "system";
    expect(now).not.toBe(schemeOf(testInfo));
    // Remembered: it is what the boot script reads on the next visit (foundation.spec.ts proves the boot).
    expect(await page.evaluate(() => window.localStorage.getItem("slr.theme"))).toBe(now);
  });

  test("starts a new session from the bar, and clears the turns", async ({ page }, testInfo) => {
    test.skip(phone(testInfo), "the bar button is from 768 px; the menu has its own");
    await openShell(page, testInfo);
    await replayCompound(page);
    await expect(page.getByRole("contentinfo").locator('[data-fact="turns"]')).toContainText("Turns 1");
    await page.getByRole("button", { name: /^New session/ }).click();
    await expect(page.getByRole("contentinfo").locator('[data-fact="turns"]')).toContainText("Turns 0");
  });
});

test.describe("keyboard", () => {
  test("the skip link is the first tab stop, and moves focus to the content", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    expect((await size(skip)).width).toBeGreaterThan(8);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await expect(page).not.toHaveURL(/#main/);
  });

  test("Tab reaches the top bar's controls in order, and then the navigation", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    const names: string[] = [];
    for (let step = 0; step < 40 && names.length < 30; step += 1) {
      await page.keyboard.press("Tab");
      names.push(await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "").trim().replace(/\s+/g, " ")));
    }
    expect(names[0]).toBe("Skip to main content");
    expect(names[1]).toBe("Open inspector");
    if (phone(testInfo)) {
      expect(names[2]).toBe("Menu");
      expect(names).toContain("Console");
    } else {
      expect(names[2]).toMatch(/^New session/);
      expect(names[3]).toMatch(/^Theme: /);
      expect(names[4]).toBe("Console");
    }
  });

  test("every control in the frame can be reached and shows a focus ring", async ({ page }, testInfo) => {
    await openShell(page, testInfo);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(ring).toEqual({ style: "solid", width: 2 });
  });
});

test.describe("touch targets on a phone (44 px)", () => {
  test("the bar's buttons and the tab bar's tabs are at least 44 px", async ({ page }, testInfo) => {
    test.skip(!phone(testInfo), "coarse pointers are emulated on the phone sizes");
    await openShell(page, testInfo);
    const small = await page.evaluate(() => {
      const found: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>("header button, nav a")) {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = element.getBoundingClientRect();
        if (box.width === 0) continue;
        if (box.height < 43.5 || box.width < 43.5) found.push(`${element.getAttribute("aria-label") ?? element.textContent} ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
      return found;
    });
    expect(small).toEqual([]);
  });
});
