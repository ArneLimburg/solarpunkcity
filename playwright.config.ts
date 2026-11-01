import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:5173/solarpunkcity/";

export default defineConfig({
  testDir: "./e2e",
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
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
