import { type Page } from "@playwright/test";
import { promises as fs } from "node:fs";

// Trigger a download and return its filename + parsed JSON envelope.
export async function expectJsonDownload(
  page: Page,
  trigger: () => Promise<void>
): Promise<{ filename: string; json: any }> {
  const [download] = await Promise.all([page.waitForEvent("download"), trigger()]);
  const path = await download.path();
  const raw = await fs.readFile(path, "utf8");
  return { filename: download.suggestedFilename(), json: JSON.parse(raw) };
}

// Feed a JSON object to the hidden import file input.
export async function importJson(page: Page, name: string, obj: unknown): Promise<void> {
  await page.locator('input[type=file]').setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(obj)),
  });
}

// Feed raw text (used for malformed JSON + CSV cases) to the import input.
export async function importText(
  page: Page,
  name: string,
  text: string,
  mimeType = "application/json"
): Promise<void> {
  await page.locator('input[type=file]').setInputFiles({
    name,
    mimeType,
    buffer: Buffer.from(text),
  });
}
