import { test, expect } from "../fixtures/base";
import { acceptNextConfirm, dismissNextConfirm } from "../fixtures/dialogs";

const themeMode = (app: any) =>
  app.evaluate(() => JSON.parse(localStorage.getItem("joy-matrix-theme-v1") || "{}").mode);

test.describe("@core header", () => {
  test("toggles light/dark and persists the choice", async ({ app }) => {
    expect(await themeMode(app)).toBe("light");
    await app.getByRole("button", { name: "Toggle light/dark" }).click();
    expect(await themeMode(app)).toBe("dark");
    // When dark, the button offers the way back to light.
    await expect(app.getByRole("button", { name: "Toggle light/dark" })).toContainText("light");
  });

  test("opens and closes the customize panel", async ({ app }) => {
    await app.getByRole("button", { name: "Customize colors" }).click();
    await expect(app.getByTestId("customize-panel")).toBeVisible();
    await app.getByRole("button", { name: "Close customize panel" }).click();
    await expect(app.getByTestId("customize-panel")).toBeHidden();
  });

  test("goal A→B text persists across reload", async ({ app }) => {
    await app.getByPlaceholder("where you are now").fill("scrappy prototype");
    await app.getByPlaceholder("where you want to be").fill("market leader");
    await app.reload();
    await expect(app.getByPlaceholder("where you are now")).toHaveValue("scrappy prototype");
    await expect(app.getByPlaceholder("where you want to be")).toHaveValue("market leader");
  });
});

test.describe("@core header demo/clear", () => {
  test.use({ seed: "empty" });

  test("Demo loads sample data when confirmed", async ({ app }) => {
    await expect(app.getByText(/No team members yet/)).toBeHidden(); // matrix tab first
    acceptNextConfirm(app);
    await app.getByRole("button", { name: "demo" }).click();
    await expect(app.getByText(/Maya/).first()).toBeVisible();
  });

  test("Demo does nothing when dismissed", async ({ app }) => {
    dismissNextConfirm(app);
    await app.getByRole("button", { name: "demo" }).click();
    await expect(app.getByText(/Maya/)).toHaveCount(0);
  });
});

test.describe("@core header clear", () => {
  test("Clear wipes the project when confirmed", async ({ app }) => {
    acceptNextConfirm(app);
    await app.getByRole("button", { name: "clear" }).click();
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await expect(app.getByText(/No team members yet/)).toBeVisible();
  });

  test("Clear does nothing when dismissed", async ({ app }) => {
    dismissNextConfirm(app);
    await app.getByRole("button", { name: "clear" }).click();
    await expect(app.getByText(/Maya/).first()).toBeVisible();
  });
});
