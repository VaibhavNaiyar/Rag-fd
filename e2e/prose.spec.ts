import { expect, test } from "@playwright/test";
import { waitForHydration, widthOf } from "./helpers/app";
import { findOverflow } from "./helpers/overflow";

/*
 * P1-F04: an answer body never causes a horizontal scrollbar. The fixtures hold
 * no tables and no code, so this puts the worst case on the page: a four-column
 * table, a 200-character line of code, an unbroken identifier and a long URL,
 * inside the same .answer-prose the answer renderer uses, styled by the real
 * built stylesheet. It is not a baseline measurement: it always enforces.
 */

const LONG_LINE = `const value = ${"veryLongIdentifierName".repeat(9)};`;
const IDENTIFIER = "c8ba5e906dda6e84c8ba5e906dda6e84c8ba5e906dda6e84c8ba5e906dda6e84";
const URL_TEXT = "https://example.com/a/very/long/path/that/keeps/going/and/going/and/going/without/any/break/at/all?query=1";

const table = (extra = "") => `
  <table ${extra}>
    <thead><tr><th>Venue</th><th>Capacity</th><th>Cancellation window</th><th>Catering</th></tr></thead>
    <tbody>
      <tr><td data-label="Venue">Riverside Hall</td><td data-label="Capacity">30 seated, 45 standing</td><td data-label="Cancellation window">15 or more calendar days for a full refund</td><td data-label="Catering">In-house kitchen; Jain options ${IDENTIFIER}</td></tr>
      <tr><td data-label="Venue">Baner Tech Hub</td><td data-label="Capacity">40</td><td data-label="Cancellation window">7 to 14 days for 50 percent</td><td data-label="Catering">Vendor directory</td></tr>
    </tbody>
  </table>`;

const body = (tableAttributes = "") => `
  <div class="answer-prose" id="probe">
    <p>An identifier that never breaks: ${IDENTIFIER} and a link ${URL_TEXT}.</p>
    ${table(tableAttributes)}
    <pre><code>${LONG_LINE}</code></pre>
    <p>Inline <code>${"x".repeat(120)}</code> code.</p>
    <ul><li>${IDENTIFIER}${IDENTIFIER}</li></ul>
  </div>`;

test.describe("answer prose", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
  });

  test("never overflows horizontally, whatever the content", async ({ page }) => {
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", `<div style="width:100%;padding:0 12px">${html}</div>`), body());
    expect(await findOverflow(page)).toEqual([]);
  });

  test("wraps a code block instead of scrolling it", async ({ page }) => {
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", `<div style="width:100%">${html}</div>`), body());
    const pre = await page.locator("#probe pre").evaluate((element) => ({
      whiteSpace: getComputedStyle(element).whiteSpace,
      overflowX: getComputedStyle(element).overflowX,
      wider: element.scrollWidth > element.clientWidth,
    }));
    expect(pre).toEqual({ whiteSpace: "pre-wrap", overflowX: "visible", wider: false });
  });

  test("turns a labelled table into records when its container is narrow, and keeps a table when it is wide", async ({ page }, testInfo) => {
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", `<div style="width:100%">${html}</div>`), body("data-reflow"));
    const container = await page.locator("#probe").evaluate((element) => element.getBoundingClientRect().width);
    const display = await page.locator("#probe td").first().evaluate((element) => getComputedStyle(element).display);
    if (container < 480) {
      expect(display).toBe("grid");
      const label = await page.locator("#probe td").first().evaluate((element) => getComputedStyle(element, "::before").content);
      expect(label).toContain("Venue");
    } else {
      expect(display).toBe("table-cell");
    }
    expect(await findOverflow(page), `at ${widthOf(testInfo)}px`).toEqual([]);
  });
});
