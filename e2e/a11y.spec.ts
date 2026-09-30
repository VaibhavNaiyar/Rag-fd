import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";
import { STATES, openState, recordDefects, widthOf } from "./helpers/app";

/*
 * R5: WCAG 2.2 A and AA, checked by axe-core in every state, in both themes.
 * Every violation is recorded with its impact; the ones that fail the test in
 * enforce mode are serious and critical. Colour contrast is included: axe reads
 * the computed colours, so it tests the tokens as they actually render.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("accessibility", () => {
  for (const state of STATES) {
    test(state.name, async ({ page }, testInfo) => {
      test.skip(state.below !== undefined && widthOf(testInfo) >= state.below, `only below ${state.below}px`);
      await openState(page, testInfo, state);

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const all = results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact ?? "minor",
        help: violation.help,
        nodes: violation.nodes.length,
        examples: violation.nodes.slice(0, 4).map((node) => node.target.join(" ")),
      }));
      const blocking = all.filter((violation) => violation.impact === "serious" || violation.impact === "critical");

      await recordDefects(testInfo, "a11y", state.name, blocking, { all, viewport: widthOf(testInfo) });
    });
  }
});
