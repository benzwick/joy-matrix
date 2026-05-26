import { test, expect } from "../fixtures/base";
import { BURNOUT_STATE, HEALTHY_STATE } from "../data/seeds";

test.describe("@core insights demo", () => {
  test("shows headline stats and per-person load", async ({ app }) => {
    await app.getByRole("button", { name: "Insights", exact: true }).click();
    await expect(app.getByRole("heading", { name: "The Reading" })).toBeVisible();
    for (const label of ["Total Joy Index", "Total Talent Fit", "Burnout", "Stretched"]) {
      await expect(app.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(app.getByText("JOY × LOAD PER PERSON")).toBeVisible();
    await expect(app.getByText("Maya").first()).toBeVisible();
  });
});

test.describe("@core insights burnout", () => {
  test.use({ seed: BURNOUT_STATE });

  test("flags burnout, pain points and the 'Stop' narrative", async ({ app }) => {
    await app.getByRole("button", { name: "Insights", exact: true }).click();
    await expect(app.getByText("PAIN POINTS — RECONSIDER")).toBeVisible();
    await expect(app.getByText(/Stop\. Someone is over capacity/)).toBeVisible();
    await expect(app.getByText(/The grind/)).toBeVisible();
  });
});

test.describe("@core insights healthy", () => {
  test.use({ seed: HEALTHY_STATE });

  test("reports a healthy state", async ({ app }) => {
    await app.getByRole("button", { name: "Insights", exact: true }).click();
    await expect(app.getByText(/Healthy state/)).toBeVisible();
  });
});
