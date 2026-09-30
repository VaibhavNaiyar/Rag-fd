import { expect, test } from "@playwright/test";
import { findOverflow } from "./helpers/overflow";

/*
 * A check that has never failed proves nothing. This feeds the overflow detector
 * pages with a known defect, and pages that only look like one, and asserts it
 * tells them apart. It needs no app and no theme, so it runs in a single project.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "375-light", "the detector is viewport-independent; one project is enough");
});

const page375 = (body: string) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">${body}</body>`;

test.describe("overflow detector", () => {
  test("finds a wide block in normal flow", async ({ page }) => {
    await page.setContent(page375('<div style="width:900px;height:20px">wide</div>'));
    const found = await findOverflow(page);
    expect(found.map((item) => item.kind)).toEqual(expect.arrayContaining(["the page scrolls sideways", "extends past the right edge"]));
  });

  test("finds a scrollable region that holds wider content", async ({ page }) => {
    await page.setContent(page375('<div id="box" style="width:300px;overflow-x:auto"><div style="width:900px;height:20px">wide</div></div>'));
    const found = await findOverflow(page);
    expect(found.map((item) => item.kind)).toContain("a scrollable region holds wider content");
    expect(found.find((item) => item.kind === "a scrollable region holds wider content")?.element).toContain("#box");
  });

  test("finds a code block that scrolls", async ({ page }) => {
    await page.setContent(page375(`<pre style="overflow-x:auto;width:300px;margin:0">${"x".repeat(300)}</pre>`));
    expect((await findOverflow(page)).map((item) => item.kind)).toContain("a scrollable region holds wider content");
  });

  test("ignores a clean page", async ({ page }) => {
    await page.setContent(page375("<p>Nothing wide here.</p>"));
    expect(await findOverflow(page)).toEqual([]);
  });

  test("ignores content clipped by an ancestor: it draws no scrollbar", async ({ page }) => {
    await page.setContent(page375('<div style="width:300px;overflow:hidden"><div style="width:900px;height:20px">clipped</div></div>'));
    expect(await findOverflow(page)).toEqual([]);
  });

  test("ignores left-hand overflow: it cannot scroll", async ({ page }) => {
    await page.setContent(page375('<div style="position:relative;left:-500px;width:100px;height:20px">off to the left</div>'));
    expect(await findOverflow(page)).toEqual([]);
  });

  test("ignores a closed drawer parked off screen with position: fixed", async ({ page }) => {
    await page.setContent(page375('<nav style="position:fixed;top:0;bottom:0;left:0;width:260px;transform:translateX(-100%)">drawer</nav><p>page</p>'));
    expect(await findOverflow(page)).toEqual([]);
  });

  test("ignores elements that are not rendered (display: none)", async ({ page }) => {
    await page.setContent(page375('<div hidden style="width:900px">hidden</div><div style="display:none;width:900px">hidden</div>'));
    expect(await findOverflow(page)).toEqual([]);
  });

  test("still reports the page scroll an invisible element causes: visibility: hidden keeps its space", async ({ page }) => {
    await page.setContent(page375('<div style="visibility:hidden;width:900px;height:10px">invisible but laid out</div>'));
    expect((await findOverflow(page)).map((item) => item.kind)).toEqual(["the page scrolls sideways"]);
  });
});
