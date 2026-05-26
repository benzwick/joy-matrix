import { test, expect, type Page } from "../fixtures/base";
import { SCHEDULE_STATE } from "../data/seeds";

const dueDate = (app: Page) =>
  app.evaluate(
    () => JSON.parse(localStorage.getItem("joy-matrix-state-v1") || "{}").tasks[0].dueDate
  );

test.describe("@core tasks due date", () => {
  test.use({ seed: SCHEDULE_STATE });

  test.beforeEach(async ({ app }) => {
    await app.getByRole("button", { name: "Tasks", exact: true }).click();
    await app.getByTestId("task-edit-t-build").click();
  });

  test("switches between none / fuzzy / exact", async ({ app }) => {
    // Seed starts fuzzy "this-week".
    await expect(app.getByTestId("task-duedate-fuzzy")).toBeVisible();
    await expect(app.getByTestId("task-duedate-fuzzy").locator("option")).toHaveCount(11);

    await app.getByTestId("task-duedate-mode-none").click();
    await expect(app.getByTestId("task-duedate-fuzzy")).toBeHidden();
    expect(await dueDate(app)).toBeNull();

    await app.getByTestId("task-duedate-mode-fuzzy").click();
    await app.getByTestId("task-duedate-fuzzy").selectOption("tomorrow");
    expect(await dueDate(app)).toEqual({ kind: "fuzzy", value: "tomorrow" });

    await app.getByTestId("task-duedate-mode-exact").click();
    await expect(app.getByTestId("task-duedate-exact")).toBeVisible();
    expect((await dueDate(app)).kind).toBe("exact");
  });
});
