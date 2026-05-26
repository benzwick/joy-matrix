import { test, expect } from "../fixtures/base";
import { importText } from "../helpers/files";

const CSV = [
  "Title,Urgency,Importance,Effort,Due,Assignee,Category",
  "Write the docs,High,High,2,this-week,Dana,Docs",
  "Fix the bug,Low,Medium,1,tomorrow,,Bugs",
].join("\n");

test.describe("@core csv import", () => {
  test.use({ seed: "empty" });

  test("opens the mapping modal and imports tasks", async ({ app }) => {
    await importText(app, "tasks.csv", CSV, "text/csv");

    const modal = app.getByTestId("csv-import-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Import from CSV")).toBeVisible();
    // Auto-detected the Title column, so the preview lists drafted tasks.
    await expect(modal.getByText("Write the docs")).toBeVisible();

    await app.getByTestId("csv-commit").click();
    await expect(modal).toBeHidden();

    await app.getByRole("button", { name: "Tasks", exact: true }).click();
    const titles = app.locator('[data-testid^="task-title-"]');
    await expect(titles).toHaveCount(2);
    await expect(titles.nth(0)).toHaveValue("Write the docs");
    await expect(titles.nth(1)).toHaveValue("Fix the bug");
  });

  test("cancel closes the modal without importing", async ({ app }) => {
    await importText(app, "tasks.csv", CSV, "text/csv");
    await expect(app.getByTestId("csv-import-modal")).toBeVisible();
    await app.getByRole("button", { name: "Cancel" }).click();
    await expect(app.getByTestId("csv-import-modal")).toBeHidden();

    await app.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(app.getByText("No tasks yet.")).toBeVisible();
  });
});
