import { test, expect } from "../fixtures/base";

test.describe("@core @mobile responsive (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("collapses inactive tab labels to icons", async ({ app }) => {
    // On the Matrix tab, the inactive "Team" tab shows only its icon.
    await expect(app.getByText("Team", { exact: true })).toBeHidden();
    // Activating a tab reveals its label.
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await expect(app.getByText("Team", { exact: true })).toBeVisible();
  });

  test("stacks the goal box (both fields usable)", async ({ app }) => {
    await app.getByPlaceholder("where you are now").fill("A");
    await app.getByPlaceholder("where you want to be").fill("B");
    await expect(app.getByPlaceholder("where you are now")).toHaveValue("A");
    await expect(app.getByPlaceholder("where you want to be")).toHaveValue("B");
  });
});

test.describe("@core responsive (desktop)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("shows every tab label", async ({ app }) => {
    for (const label of ["Matrix", "Team", "Tasks", "Schedule", "Insights"]) {
      await expect(app.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
