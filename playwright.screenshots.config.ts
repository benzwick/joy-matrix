import { defineConfig, devices } from "@playwright/test";

// Dedicated config for generating documentation screenshots. Separate from
// playwright.config.ts (the e2e suite) so it runs a single browser/viewport,
// loads real fonts, and writes into public/screenshots/. Invoke with
// `npm run screenshots`.

const PORT = 5173;

export default defineConfig({
  testDir: "./tests/e2e/screenshots",
  testMatch: "**/*.screenshots.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/screenshots-artifacts",
  reporter: [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: "docs",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 },
    },
  ],

  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
