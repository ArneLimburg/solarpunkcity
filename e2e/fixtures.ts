import { test as base } from "@playwright/test";
import { createCoverageReport } from "./coverage";

export { expect } from "@playwright/test";

export const test = base.extend<{
  collectCoverage: void;
  // unlocks all building types after every navigation; the tests of the
  // unlock rules switch it off with `test.use({ unlockAll: false })`
  unlockAll: boolean;
}>({
  unlockAll: [true, { option: true }],
  page: [
    async ({ page, unlockAll }, use) => {
      const goto = page.goto.bind(page);
      page.goto = async (...args) => {
        const response = await goto(...args);
        if (unlockAll) {
          await page.waitForFunction(() => window.__solarpunk, null, {
            polling: 50,
          });
          await page.evaluate(() => window.__solarpunk?.unlockAll());
        }
        return response;
      };
      await use(page);
    },
    { scope: "test" },
  ],
  collectCoverage: [
    async ({ page }, use) => {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      const coverage = await page.coverage.stopJSCoverage();
      await createCoverageReport().add(coverage);
    },
    { auto: true },
  ],
});
