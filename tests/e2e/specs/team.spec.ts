import { test, expect } from "../fixtures/base";
import { acceptNextPrompt } from "../fixtures/dialogs";
import { setRange } from "../helpers/sliders";
import { SCHEDULE_STATE } from "../data/seeds";

test.describe("@core team add/remove", () => {
  test.use({ seed: "empty" });

  test("adds then removes a member", async ({ app }) => {
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await expect(app.getByText(/No team members yet/)).toBeVisible();

    acceptNextPrompt(app, "Dana");
    await app.getByRole("button", { name: "add member" }).click();
    const nameInput = app.locator('[data-testid^="member-name-"]');
    await expect(nameInput).toHaveValue("Dana");

    await app.locator('[data-testid^="member-remove-"]').first().click();
    await expect(nameInput).toHaveCount(0);
    await expect(app.getByText(/No team members yet/)).toBeVisible();
  });

  test("ignores add when the prompt is cancelled", async ({ app }) => {
    await app.getByRole("button", { name: "Team", exact: true }).click();
    // No prompt handler → dialog auto-dismisses → no member added.
    await app.getByRole("button", { name: "add member" }).click();
    await expect(app.getByText(/No team members yet/)).toBeVisible();
  });
});

test.describe("@core team controls", () => {
  test.use({ seed: SCHEDULE_STATE });

  test.beforeEach(async ({ app }) => {
    await app.getByRole("button", { name: "Team", exact: true }).click();
    await expect(app.getByTestId("member-card-m-avery")).toBeVisible();
  });

  test("edits name and capacity", async ({ app }) => {
    await app.getByTestId("member-name-m-avery").fill("Avery R.");
    await expect(app.getByTestId("member-name-m-avery")).toHaveValue("Avery R.");

    await setRange(app.getByTestId("member-capacity-m-avery"), -2);
    await expect(app.getByTestId("member-card-m-avery")).toContainText("near limit");
  });

  test("tunes category baselines", async ({ app }) => {
    await app.getByTestId("toggle-baselines-m-avery").click();
    const slider = app.getByTestId("baseline-m-avery-c-eng-pleasure");
    await expect(slider).toBeVisible();
    await setRange(slider, 3);
    await expect(slider).toHaveValue("3");
  });

  test("removes and refills an availability range", async ({ app }) => {
    await app.getByTestId("toggle-availability-m-avery").click();
    await expect(app.getByTestId("avail-m-avery-mon-from-0")).toHaveValue("09:00");

    // Remove Monday's only window — the row falls back to "off".
    await app.getByTestId("avail-m-avery-mon-remove-0").click();
    await expect(app.getByTestId("avail-m-avery-mon-from-0")).toBeHidden();

    // The quick-fill button restores weekday windows.
    await app.getByTestId("avail-m-avery-fill-weekdays").click();
    await expect(app.getByTestId("avail-m-avery-mon-from-0")).toHaveValue("09:00");
  });

  test("tunes energy/concentration windows", async ({ app }) => {
    await app.getByTestId("toggle-windows-m-avery").click();
    const energy = app.getByTestId("window-m-avery-morning-energy");
    await expect(energy).toBeVisible();
    await setRange(energy, 3);
    await expect(energy).toHaveValue("3");
  });
});
