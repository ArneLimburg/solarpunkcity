import { test as base } from "@playwright/test";
import { createCoverageReport } from "./coverage";

export { expect } from "@playwright/test";

export const test = base.extend<{ collectCoverage: void }>({
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
