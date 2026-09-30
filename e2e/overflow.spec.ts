import { test } from "@playwright/test";
import { STATES, openState, recordDefects, widthOf } from "./helpers/app";
import { findOverflow } from "./helpers/overflow";

/*
 * R4: no horizontal scrollbar, anywhere, in any state, at any viewport, in either
 * theme. What counts as overflow is defined once, in helpers/overflow.ts, and
 * proven against known-bad and known-good pages by harness.spec.ts.
 */
test.describe("no horizontal overflow", () => {
  for (const state of STATES) {
    test(state.name, async ({ page }, testInfo) => {
      test.skip(state.below !== undefined && widthOf(testInfo) >= state.below, `only below ${state.below}px`);
      await openState(page, testInfo, state);
      await recordDefects(testInfo, "overflow", state.name, await findOverflow(page), { viewport: widthOf(testInfo) });
    });
  }
});
