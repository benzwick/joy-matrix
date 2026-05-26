import { test, expect } from "../fixtures/base";

test.describe("@core navigation", () => {
  test("switches sections and resets to Matrix on reload", async ({ app }) => {
    await app.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(app.getByRole("heading", { name: "The Schedule" })).toBeVisible();

    // Tab selection lives in memory only — a reload returns to Matrix.
    await app.reload();
    await expect(app.getByRole("heading", { name: "The Matrix" })).toBeVisible();
    await expect(app.getByRole("heading", { name: "The Schedule" })).toBeHidden();
  });
});
