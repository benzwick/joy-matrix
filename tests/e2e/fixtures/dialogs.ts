import { type Page, type Dialog } from "@playwright/test";

// Native window.prompt / confirm / alert helpers. Playwright auto-dismisses
// dialogs unless a handler is registered, so these MUST be called BEFORE the
// action that triggers the dialog. Each handler is one-shot (page.once) so it
// won't leak into later interactions in the same test.

export function acceptNextPrompt(page: Page, value: string): void {
  page.once("dialog", (d: Dialog) => d.accept(value));
}

export function acceptNextConfirm(page: Page): void {
  page.once("dialog", (d: Dialog) => d.accept());
}

export function dismissNextConfirm(page: Page): void {
  page.once("dialog", (d: Dialog) => d.dismiss());
}

// Capture the message of the next dialog (e.g. an alert) and accept it.
// Returns a promise that resolves with the message text for assertions.
export function captureNextDialog(page: Page): Promise<string> {
  return new Promise<string>((resolve) => {
    page.once("dialog", async (d: Dialog) => {
      const msg = d.message();
      await d.accept();
      resolve(msg);
    });
  });
}
