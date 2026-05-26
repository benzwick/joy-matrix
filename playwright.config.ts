import { defineConfig, devices } from "@playwright/test";

// Viewport profiles. The app's only responsive breakpoint is JS-driven
// (isPhone = innerWidth < 480), so we drive responsiveness purely by
// overriding viewport width on a desktop engine — no touch/mobile-UA
// descriptor needed.
const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  laptop: { width: 1366, height: 768 },
  desktop: { width: 1680, height: 1050 },
} as const;

const ENGINES = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;

// 3 engines × 4 sizes = 12 projects named `${engine}-${size}`.
const projects = Object.entries(ENGINES).flatMap(([engine, engineDevice]) =>
  Object.entries(SIZES).map(([size, viewport]) => ({
    name: `${engine}-${size}`,
    use: { ...engineDevice, viewport },
  }))
);

// FULL_ARTIFACTS=1 turns on trace/video/screenshot for EVERY test (heavy —
// use for a targeted debug run or nightly). By default the built-in capture
// stays failure-oriented; passing-test artifacts come from the always-on
// screenshot + console-log fixtures in tests/e2e/fixtures/artifacts.ts.
const FULL = !!process.env.FULL_ARTIFACTS;

const PORT = process.env.E2E_DEV ? 5173 : 4173;

export default defineConfig({
  testDir: "./tests/e2e/specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  outputDir: "test-results/artifacts-pw",

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],

  use: {
    baseURL: `http://localhost:${PORT}`,
    // Pin timezone + locale so the schedule (which reads `new Date()` and
    // toLocaleDateString) renders identically on every machine/runner.
    timezoneId: "UTC",
    locale: "en-US",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: FULL ? "on" : "only-on-failure",
    video: FULL ? "on" : "retain-on-failure",
    trace: FULL ? "on" : "on-first-retry",
  },

  projects,

  webServer: {
    command: process.env.E2E_DEV
      ? "npm run dev -- --port 5173 --strictPort"
      : "npm run build && npm run preview -- --port 4173 --strictPort",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
