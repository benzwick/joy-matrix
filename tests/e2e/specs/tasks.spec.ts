import { test, expect } from "../fixtures/base";
import { acceptNextPrompt } from "../fixtures/dialogs";
import { setRange } from "../helpers/sliders";
import { SCHEDULE_STATE } from "../data/seeds";

test.describe("@core tasks add", () => {
  test.use({ seed: "empty" });

  test("adds a task via the prompt", async ({ app }) => {
    await app.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(app.getByText("No tasks yet.")).toBeVisible();

    acceptNextPrompt(app, "Draft the spec");
    await app.getByRole("button", { name: "add task" }).click();
    await expect(app.locator('[data-testid^="task-title-"]')).toHaveValue("Draft the spec");
  });
});

test.describe("@core tasks editor", () => {
  test.use({ seed: SCHEDULE_STATE });

  test.beforeEach(async ({ app }) => {
    await app.getByRole("button", { name: "Tasks", exact: true }).click();
    await app.getByTestId("task-edit-t-build").click();
    await expect(app.getByTestId("task-urgency")).toBeVisible();
  });

  test("scoring sliders move the task between quadrants", async ({ app }) => {
    const card = app.getByTestId("task-card-t-build");
    await expect(card).toContainText("DO"); // urgency 4, importance 4
    await setRange(app.getByTestId("task-importance"), 1);
    await expect(card).toContainText("DELEGATE"); // urgent, not important
  });

  test("edits per-member fit and title", async ({ app }) => {
    await setRange(app.getByTestId("task-fit-m-avery-pleasure"), -3);
    await expect(app.getByTestId("task-fit-m-avery-pleasure")).toHaveValue("-3");

    await app.getByTestId("task-title-t-build").fill("Build it well");
    await expect(app.getByTestId("task-title-t-build")).toHaveValue("Build it well");
  });

  test("assigns category and stakeholder", async ({ app }) => {
    await app.getByTestId("task-category").selectOption({ label: "Engineering" });
    await expect(app.getByTestId("task-category")).toHaveValue("c-eng");
    await app.getByTestId("task-stakeholder").selectOption({ label: "Early users" });
    await expect(app.getByTestId("task-stakeholder")).toHaveValue("s-users");
  });

  test("deletes the task", async ({ app }) => {
    // On phone the delete button only shows while the editor is closed, so
    // close it first (the beforeEach opened it). On desktop it's always shown.
    await app.getByTestId("task-edit-t-build").click();
    await app.getByTestId("task-delete-t-build").click();
    await expect(app.getByTestId("task-card-t-build")).toBeHidden();
    await expect(app.getByText("No tasks yet.")).toBeVisible();
  });
});
