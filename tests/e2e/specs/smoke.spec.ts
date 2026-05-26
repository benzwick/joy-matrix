import { test, expect, unexpectedErrors } from "../fixtures/base";

test.describe("@core smoke", () => {
  test("boots on demo data with a clean console", async ({ app, consoleErrors }) => {
    await expect(app.getByRole("heading", { level: 1 })).toContainText("From");
    // Demo data assigns the landing-page task to Maya in the matrix.
    await expect(app.getByText(/Maya/).first()).toBeVisible();
    expect(unexpectedErrors(consoleErrors)).toEqual([]);
  });

  test("renders all five tab sections", async ({ app }) => {
    for (const [tab, heading] of [
      ["Matrix", "The Matrix"],
      ["Team", "The Team"],
      ["Tasks", "The Tasks"],
      ["Schedule", "The Schedule"],
      ["Insights", "The Reading"],
    ] as const) {
      await app.getByRole("button", { name: tab, exact: true }).click();
      await expect(app.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});
