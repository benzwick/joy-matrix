// Generates the screenshots embedded in the documentation page
// (src/docs/DocsApp.jsx). These are NOT assertions — each test seeds the app
// with the built-in demo project, drives it to a particular view, and writes a
// PNG into public/screenshots/. The deploy workflow runs this before
// `vite build`, so the freshly-captured images get copied into dist/screenshots/
// and the docs always show the current UI.
//
// This file lives outside the main config's testDir (tests/e2e/specs), so a
// normal `npm run test:e2e` never runs it. Run it via `npm run screenshots`,
// which uses playwright.screenshots.config.ts (single project, real fonts).

import { promises as fs } from "node:fs";
import { test } from "../fixtures/base";
import { FROZEN_NOW } from "../data/seeds";
import type { Locator, Page } from "@playwright/test";

const OUT = "public/screenshots";

async function settle(page: Page) {
  await page.evaluate(async () => {
    try { if ((document as any).fonts?.ready) await (document as any).fonts.ready; } catch {}
  });
  await page.waitForTimeout(400);
}

async function capture(locator: Locator, name: string) {
  await fs.mkdir(OUT, { recursive: true });
  await locator.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled" });
}

test.describe("docs screenshots — static", () => {
  // Real fonts (blockExternal:false) so screenshots match the branded look.
  test.use({ seed: "demo", themeMode: "light", blockExternal: false });

  test("header + matrix + insights", async ({ app }) => {
    await settle(app);
    await capture(app.locator("header").first(), "header");
    await capture(app.locator("main").first(), "matrix"); // matrix is the default tab

    await app.getByRole("button", { name: "Insights", exact: true }).click();
    await app.getByRole("heading", { name: "The Reading" }).waitFor();
    await settle(app);
    await capture(app.locator("main").first(), "insights");
  });

  test("team + baselines", async ({ app }) => {
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await app.locator('[data-testid^="member-card-"]').first().waitFor();
    await settle(app);
    await capture(app.locator("main").first(), "team");

    await app.locator('[data-testid^="toggle-baselines-"]').first().click();
    await settle(app);
    await capture(app.locator('[data-testid^="member-card-"]').first(), "team-baselines");
  });

  test("tasks + editor", async ({ app }) => {
    await app.getByRole("button", { name: "Tasks", exact: true }).click();
    await app.locator('[data-testid^="task-card-"]').first().waitFor();
    await settle(app);
    await capture(app.locator("main").first(), "tasks");

    await app.locator('[data-testid^="task-edit-"]').first().click();
    await app.getByTestId("task-urgency").waitFor();
    await settle(app);
    await capture(app.locator('[data-testid^="task-card-"]').first(), "tasks-editor");
  });

  test("customize panel", async ({ app }) => {
    await app.getByRole("button", { name: /customize/i }).click();
    await app.getByTestId("customize-panel").waitFor();
    await settle(app);
    await capture(app.getByTestId("customize-panel"), "customize");
  });

  test("csv import dialog", async ({ app }) => {
    const csv = [
      "Title,Urgency,Importance,Effort,Assignee,Category,Due",
      "Fix onboarding crash,5,4,2,Maya,Engineering,this-week",
      "Design pricing page,3,5,3,Sam,Design,soon",
      "Migrate analytics events,2,3,4,Jordan,Engineering,later",
      "Write release notes,4,2,1,Maya,Marketing,tomorrow",
    ].join("\n");
    await app.locator('input[type="file"]').setInputFiles({
      name: "tasks.csv", mimeType: "text/csv", buffer: Buffer.from(csv),
    });
    await app.getByTestId("csv-import-modal").waitFor();
    await settle(app);
    await capture(app.getByTestId("csv-import-modal"), "csv-import");
  });
});

test.describe("docs screenshots — schedule", () => {
  // Freeze "now" to a Monday so the demo's fuzzy due dates resolve into real
  // blocks across the week, making every schedule sub-view non-empty.
  test.use({ seed: "demo", themeMode: "light", blockExternal: false, freezeAt: FROZEN_NOW });

  test("schedule views", async ({ app }) => {
    await app.getByRole("button", { name: "Schedule", exact: true }).click();
    await app.getByRole("heading", { name: "The Schedule" }).waitFor();
    for (const view of ["week", "day", "month", "year"] as const) {
      await app.getByTestId(`schedule-view-${view}`).click();
      await settle(app);
      await capture(app.locator("main").first(), `schedule-${view}`);
    }
  });
});
