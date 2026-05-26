import { test, expect } from "../../fixtures/base";
import { liveCreds, openChatAndLogin, openSettings, modelSelect } from "../../fixtures/live";

const creds = liveCreds();

test.describe("@live chat model switch", () => {
  test.skip(!creds, "requires T2V_TEST_USER_EMAIL / T2V_TEST_USER_PASSWORD");
  test.use({ blockExternal: false, seed: "demo" });

  test("switches the active model and persists the choice", async ({ app }) => {
    await openChatAndLogin(app, creds!);
    await openSettings(app);

    const sel = modelSelect(app);
    await expect(sel).toBeVisible();
    // Wait for listModels() to populate real options (past "Loading models…").
    await expect
      .poll(async () => sel.locator("option").count(), { timeout: 30_000 })
      .toBeGreaterThan(1);

    const before = await sel.inputValue();
    const values = (
      await sel.locator("option").evaluateAll((opts) =>
        (opts as HTMLOptionElement[]).map((o) => o.value)
      )
    ).filter((v) => v && v !== before);

    test.skip(values.length === 0, "only one model available to this account");

    const next = values[0];
    await sel.selectOption(next);
    await expect(sel).toHaveValue(next);

    // Reopen settings — the selection is persisted in user preferences.
    await app.getByRole("button", { name: "Back to chat" }).click();
    await openSettings(app);
    await expect(modelSelect(app)).toHaveValue(next);
  });
});
