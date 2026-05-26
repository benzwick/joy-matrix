import { test, expect } from "../fixtures/base";

test.describe("@core matrix", () => {
  test("places demo tasks into quadrants with assignees", async ({ app }) => {
    await expect(app.getByRole("heading", { name: "The Matrix" })).toBeVisible();
    // Urgent + important task and its auto-assignee.
    const doTask = app.getByRole("button", { name: /Ship landing page redesign/ });
    await expect(doTask).toBeVisible();
    await expect(doTask).toContainText("Maya");
    // All four quadrants render (matched by their unique subtitles).
    for (const sub of [
      "urgent · important",
      "important · not urgent",
      "urgent · not important",
      "neither — drop or defer",
    ]) {
      await expect(app.getByText(sub)).toBeVisible();
    }
  });

  test("clicking a task opens its editor on the Tasks tab", async ({ app }) => {
    await app.getByRole("button", { name: /Ship landing page redesign/ }).click();
    await expect(app.getByRole("heading", { name: "The Tasks" })).toBeVisible();
    // Editor for t1 is open: per-member fit sliders for demo member m1 (Maya).
    await expect(app.getByTestId("task-fit-m1-pleasure")).toBeVisible();
  });

  test("legend expands and collapses", async ({ app }) => {
    await expect(app.getByText(/workflow order, not grid positions/)).toBeHidden();
    await app.getByTestId("legend-toggle").click();
    await expect(app.getByText(/workflow order, not grid positions/)).toBeVisible();
    await app.getByTestId("legend-toggle").click();
    await expect(app.getByText(/workflow order, not grid positions/)).toBeHidden();
  });
});
