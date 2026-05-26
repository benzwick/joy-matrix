import { test, expect } from "../../fixtures/base";
import { liveCreds, openChatAndLogin } from "../../fixtures/live";

const creds = liveCreds();

test.describe("@live chat conversation", () => {
  test.skip(!creds, "requires T2V_TEST_USER_EMAIL / T2V_TEST_USER_PASSWORD");
  test.use({ blockExternal: false, seed: "demo" });

  test("sends a message and clears the thread", async ({ app }) => {
    await openChatAndLogin(app, creds!);

    const composer = app.getByPlaceholder("Type a message…");
    await composer.fill("Reply with the single word: pong.");
    await app.getByRole("button", { name: "Send message" }).click();

    // The user's message is echoed into the thread (welcome screen replaced).
    await expect(app.getByText("Reply with the single word: pong.")).toBeVisible();
    // And an assistant reply streams back (generous timeout for the live model).
    await expect(app.getByText(/pong/i).last()).toBeVisible({ timeout: 45_000 });

    // "Clear Chat" (aria-label "New chat") resets to the welcome screen.
    await app.getByRole("button", { name: "New chat" }).click();
    await expect(app.getByRole("heading", { name: "Ask The Joy Matrix" })).toBeVisible();
  });
});
