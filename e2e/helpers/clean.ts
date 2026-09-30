import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { findOverflow } from "./overflow";

/** WCAG 2.2 A and AA, with the 2.0 and 2.1 sets they build on. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * The two checks every new view and state must pass, enforced: no horizontal scrollbar
 * or clipped content (R4), and no serious or critical accessibility violation (R5).
 * `state` names what was on screen, so a failure says which one.
 */
export async function expectClean(page: Page, state: string): Promise<void> {
  expect(await findOverflow(page), `${state}: horizontal overflow`).toEqual([]);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({ rule: violation.id, help: violation.help, examples: violation.nodes.slice(0, 4).map((node) => node.target.join(" ")) }));
  expect(blocking, `${state}: accessibility`).toEqual([]);
}
