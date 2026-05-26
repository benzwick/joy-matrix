import { test, expect, unexpectedErrors } from "../fixtures/base";
import { acceptNextPrompt } from "../fixtures/dialogs";
import { LEGACY_V3_STATE } from "../data/seeds";

test.describe("@core persistence", () => {
  test.use({ seed: "empty" });

  test("an added member survives reload", async ({ app }) => {
    await app.getByRole("button", { name: "Team", exact: true }).click();
    acceptNextPrompt(app, "Dana");
    await app.getByRole("button", { name: "add member" }).click();
    await expect(app.locator('[data-testid^="member-name-"]')).toHaveValue("Dana");

    await app.reload();
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await expect(app.locator('[data-testid^="member-name-"]')).toHaveValue("Dana");
  });

  test("theme mode survives reload", async ({ app }) => {
    await app.getByRole("button", { name: "Toggle light/dark" }).click();
    await app.reload();
    const mode = await app.evaluate(
      () => JSON.parse(localStorage.getItem("joy-matrix-theme-v1") || "{}").mode
    );
    expect(mode).toBe("dark");
  });
});

test.describe("@core persistence migration", () => {
  test.use({ seed: LEGACY_V3_STATE });

  test("loads and migrates a legacy schema without crashing", async ({ app, consoleErrors }) => {
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await expect(app.getByTestId("member-name-m-1")).toHaveValue("Legacy member");
    expect(unexpectedErrors(consoleErrors)).toEqual([]);
  });
});
