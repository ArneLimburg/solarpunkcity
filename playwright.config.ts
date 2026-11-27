import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:5173/solarpunkcity/";

export default defineConfig({
  testDir: "./e2e",
  // software rendering with V8 coverage is slow on CI runners: starting the
  // fixtures alone can take 20 s and a single pointer action more than 10 s
  timeout: 120_000,
  // balances the CI shards by test instead of by file (building.spec.ts alone is a third)
  fullyParallel: !!process.env.E2E_COVERAGE_SHARD,
  globalTeardown: "./e2e/global-teardown.ts",
  reporter: process.env.CI
    ? process.env.E2E_COVERAGE_SHARD
      ? [["github"], ["list"], ["blob"]]
      : [["github"], ["list"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 800, height: 600 },
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
