import { test, expect } from "../../fixtures/base";
import { liveCreds, openChatAndLogin } from "../../fixtures/live";

const creds = liveCreds();

test.describe("@live chat login", () => {
  test.skip(!creds, "requires T2V_TEST_USER_EMAIL / T2V_TEST_USER_PASSWORD");
  // Live tier talks to the real Talk2View API — don't block external network.
  test.use({ blockExternal: false, seed: "demo" });

  test("logs in then signs out", async ({ app }) => {
    await openChatAndLogin(app, creds!);
    await expect(app.getByRole("button", { name: "Send message" })).toBeVisible();

    await app.getByRole("button", { name: "Menu" }).click();
    await app.getByRole("menuitem", { name: "Sign out" }).click();

    // Back to the login form.
    await expect(app.locator("#t2v-email")).toBeVisible();
  });
});
