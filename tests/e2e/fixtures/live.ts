import { type Page, expect } from "@playwright/test";

export type LiveCreds = { email: string; password: string };

// Reads the Talk2View test-user secrets. Returns null when absent so @live
// specs can skip cleanly (locally / on forks) instead of failing red.
export function liveCreds(): LiveCreds | null {
  const email = process.env.T2V_TEST_USER_EMAIL;
  const password = process.env.T2V_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

// Open the chat widget and sign in if the login form is shown. After this
// resolves the Composer (send button) is visible. All selectors come from
// the @talk2view/sdk ChatWidget/LoginForm/Composer components.
export async function openChatAndLogin(page: Page, creds: LiveCreds): Promise<void> {
  // The first-run callout overlays the launcher; dismiss it if present.
  const callout = page.getByText("Try Talk2View");
  if (await callout.isVisible().catch(() => false)) {
    await callout.click();
  }

  await page.locator(".t2v-btn").click();

  const email = page.locator("#t2v-email");
  if (await email.isVisible().catch(() => false)) {
    await email.fill(creds.email);
    await page.locator("#t2v-password").fill(creds.password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({
    timeout: 30_000,
  });
}

// The LLM model <select> in the Settings panel. It is the first combobox
// rendered there ("Language Model"); on the default matrix tab no other
// <select> is present in the app, so .first() is unambiguous.
export function modelSelect(page: Page) {
  return page.locator("select").first();
}

export async function openSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
}
