import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:5173/solarpunkcity/";

export default defineConfig({
  testDir: "./e2e",
  // software rendering with V8 coverage is slow on CI runners
  timeout: 60_000,
  globalTeardown: "./e2e/global-teardown.ts",
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
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
