import { test, expect } from "../fixtures/base";
import { acceptNextPrompt, acceptNextConfirm } from "../fixtures/dialogs";
import { SCHEDULE_STATE } from "../data/seeds";

test.describe("@core categories & stakeholders", () => {
  test.use({ seed: SCHEDULE_STATE });

  test.beforeEach(async ({ app }) => {
    await app.getByRole("button", { name: "Tasks", exact: true }).click();
  });

  test("adds, renames and removes a category", async ({ app }) => {
    acceptNextPrompt(app, "Marketing");
    await app.getByTestId("add-category").click();
    await expect(app.getByRole("button", { name: "Marketing" })).toBeVisible();

    acceptNextPrompt(app, "Eng & infra");
    await app.getByTestId("category-rename-c-eng").click();
    await expect(app.getByRole("button", { name: "Eng & infra" })).toBeVisible();

    acceptNextConfirm(app);
    await app.getByTestId("category-remove-c-eng").click();
    await expect(app.getByTestId("category-chip-c-eng")).toBeHidden();
  });

  test("adds, renames and removes a stakeholder", async ({ app }) => {
    acceptNextPrompt(app, "Investors");
    await app.getByTestId("add-stakeholder").click();
    await expect(app.getByRole("button", { name: "Investors" })).toBeVisible();

    acceptNextPrompt(app, "Power users");
    await app.getByTestId("stakeholder-rename-s-users").click();
    await expect(app.getByRole("button", { name: "Power users" })).toBeVisible();

    acceptNextConfirm(app);
    await app.getByTestId("stakeholder-remove-s-users").click();
    await expect(app.getByTestId("stakeholder-chip-s-users")).toBeHidden();
  });
});
