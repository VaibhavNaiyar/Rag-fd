import { expect, test } from "@playwright/test";
import { STATES, openState, widthOf } from "./helpers/app";

/*
 * Screenshots of the states that matter, at three representative widths (phone,
 * tablet, desktop) in both themes. The full eight-viewport matrix is covered by
 * the overflow and accessibility specs; images at every width would add megabytes
 * to the repository without adding a defect the other two cannot see.
 *
 *   npm run test:e2e:update     writes or refreshes the images
 *   npm run test:e2e            compares against them
 */

const VISUAL_WIDTHS = [375, 768, 1280];
const VISUAL_STATES = ["empty", "fixtures-open", "turn-compound", "turn-late-detail", "drawer-open"];

test.describe("visual", () => {
  for (const state of STATES.filter((candidate) => VISUAL_STATES.includes(candidate.name))) {
    test(state.name, async ({ page }, testInfo) => {
      test.skip(!VISUAL_WIDTHS.includes(widthOf(testInfo)), "images are kept for three widths only");
      test.skip(state.below !== undefined && widthOf(testInfo) >= state.below, `only below ${state.below}px`);
      await openState(page, testInfo, state);
      await expect(page).toHaveScreenshot(`${state.name}.png`);
    });
  }
});
