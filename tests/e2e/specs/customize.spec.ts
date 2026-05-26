import { test, expect, type Page } from "../fixtures/base";

const theme = (app: Page) =>
  app.evaluate(() => JSON.parse(localStorage.getItem("joy-matrix-theme-v1") || "{}"));

// input[type=color] can't be driven with fill(); set the value natively and
// dispatch input so React's onChange fires (matches a real picker selection).
async function pickColor(app: Page, testId: string, hex: string) {
  await app.getByTestId(testId).evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, hex);
}

test.describe("@core customize", () => {
  test.beforeEach(async ({ app }) => {
    await app.getByRole("button", { name: "Customize colors" }).click();
    await expect(app.getByTestId("customize-panel")).toBeVisible();
  });

  test("switches theme preset", async ({ app }) => {
    await app.getByTestId("theme-preset").selectOption("workbook");
    expect((await theme(app)).themeId).toBe("workbook");
  });

  test("switches light/dark inside the panel", async ({ app }) => {
    const panel = app.getByTestId("customize-panel");
    await panel.getByRole("button", { name: "dark" }).click();
    expect((await theme(app)).mode).toBe("dark");
  });

  test("overrides and resets a color", async ({ app }) => {
    await pickColor(app, "color-paper", "#ff0000");
    expect(((await theme(app)).overrides["--joy-paper"] || "").toLowerCase()).toBe("#ff0000");

    // A reset affordance appears once overridden.
    await expect(app.getByTestId("color-reset-paper")).toBeVisible();
    await app.getByTestId("color-reset-paper").click();
    expect((await theme(app)).overrides["--joy-paper"]).toBeUndefined();
  });

  test("reset-all clears overrides", async ({ app }) => {
    await pickColor(app, "color-ink", "#123456");
    await app.getByRole("button", { name: /Reset colors to preset/i }).click();
    expect((await theme(app)).overrides).toEqual({});
  });

  test("changes a font and resets fonts", async ({ app }) => {
    await app.getByTestId("font-head").selectOption("Inter");
    expect((await theme(app)).fonts.head).toBe("Inter");
    await app.getByRole("button", { name: /Reset fonts to default/i }).click();
    expect((await theme(app)).fonts).toEqual({});
  });

  test("color override survives reload", async ({ app }) => {
    await pickColor(app, "color-teal", "#00ffcc");
    await app.reload();
    await app.getByRole("button", { name: "Customize colors" }).click();
    expect(((await theme(app)).overrides["--joy-teal"] || "").toLowerCase()).toBe("#00ffcc");
    await expect(app.getByTestId("color-reset-teal")).toBeVisible();
  });
});
