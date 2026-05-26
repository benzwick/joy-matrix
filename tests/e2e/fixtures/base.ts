import { test as base, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import {
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  EMPTY_STATE,
  FROZEN_NOW,
} from "../data/seeds";

export type SeedKind = "demo" | "empty" | Record<string, unknown>;

type Options = {
  // Initial project state. "demo" leaves localStorage untouched so the app
  // loads its built-in DEMO_STATE; "empty" seeds EMPTY_STATE; an object
  // seeds that project verbatim.
  seed: SeedKind;
  // ISO timestamp to freeze "now" at. null = real clock.
  freezeAt: string | null;
  // Force theme.mode so screenshots/assertions are deterministic.
  themeMode: "light" | "dark" | null;
  // Abort external network (Google Fonts, Talk2View API). Off for @live.
  blockExternal: boolean;
};

type Fixtures = {
  // Console messages of type "error" seen during the test (for assertions).
  consoleErrors: string[];
  // A seeded, navigated page ready to drive.
  app: Page;
};

// Network the core (offline) tier should never depend on.
const EXTERNAL = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /(^|\/\/|\.)talk2view\.com/,
];

export const test = base.extend<Options & Fixtures>({
  seed: ["demo", { option: true }],
  freezeAt: [FROZEN_NOW, { option: true }],
  themeMode: ["light", { option: true }],
  blockExternal: [true, { option: true }],

  consoleErrors: async ({}, use) => {
    await use([]);
  },

  app: async ({ page, seed, freezeAt, themeMode, blockExternal, consoleErrors }, use, testInfo) => {
    const logs: string[] = [];
    const stamp = () => new Date().toISOString();
    page.on("console", (m) => {
      logs.push(`[${stamp()}] console.${m.type()}: ${m.text()}`);
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => {
      logs.push(`[${stamp()}] pageerror: ${e.message}`);
      consoleErrors.push(`pageerror: ${e.message}`);
    });

    if (blockExternal) {
      for (const pattern of EXTERNAL) {
        await page.route(pattern, (r) => r.abort());
      }
    }

    if (freezeAt) {
      await page.clock.setFixedTime(new Date(freezeAt));
    }

    // Seed localStorage before any app script runs. Guarded on absence so it
    // seeds only the FIRST load — later reloads keep whatever the app wrote,
    // which is what persistence tests rely on.
    if (seed !== "demo" || themeMode) {
      const project = seed === "empty" ? EMPTY_STATE : seed === "demo" ? null : seed;
      await page.addInitScript(
        ([stateKey, themeKey, projectJson, mode]) => {
          if (projectJson && !localStorage.getItem(stateKey)) {
            localStorage.setItem(stateKey, projectJson);
          }
          if (mode && !localStorage.getItem(themeKey)) {
            localStorage.setItem(
              themeKey,
              JSON.stringify({ themeId: "talk2view", mode, overrides: {}, fonts: {} })
            );
          }
        },
        [STORAGE_KEY, THEME_STORAGE_KEY, project ? JSON.stringify(project) : "", themeMode || ""] as const
      );
    }

    await page.goto("/");
    // The app renders "loading…" until state hydrates; wait for real content.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await use(page);

    // ---- always-on artifacts (pass OR fail) ----
    try {
      const logPath = testInfo.outputPath("console.log");
      await fs.writeFile(logPath, logs.join("\n") + "\n", "utf8");
      await testInfo.attach("console-log", { path: logPath, contentType: "text/plain" });
    } catch {
      /* never fail a test on artifact write */
    }
    try {
      const shot = testInfo.outputPath(`final-${testInfo.status}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      await testInfo.attach(`final-${testInfo.status}`, { path: shot, contentType: "image/png" });
    } catch {
      /* page may already be closed on hard failure */
    }
  },
});

export { expect };
export type { Page };

// Console errors that are expected noise in the offline core tier (blocked
// external requests, etc.) and should not fail a "clean console" assertion.
const BENIGN_ERROR = [
  /talk2view/i,
  /fonts\.(googleapis|gstatic)/i,
  /net::ERR_/i,
  /Failed to load resource/i,
  /ERR_ABORTED/i,
  /the server responded with a status/i,
];

export function unexpectedErrors(errors: string[]): string[] {
  return errors.filter((e) => !BENIGN_ERROR.some((re) => re.test(e)));
}
