import { test, expect } from "../fixtures/base";
import { SCHEDULE_STATE } from "../data/seeds";

test.describe("@core schedule", () => {
  test.use({ seed: SCHEDULE_STATE });

  test.beforeEach(async ({ app }) => {
    await app.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(app.getByRole("heading", { name: "The Schedule" })).toBeVisible();
  });

  test("week view shows the assignee lane and a placed block", async ({ app }) => {
    await expect(app.getByText("Avery").first()).toBeVisible();
    await expect(app.getByText("Build the feature").first()).toBeVisible();
  });

  test("switches between day / week / month / year views", async ({ app }) => {
    await app.getByTestId("schedule-view-day").click();
    await expect(app.getByTestId("schedule-day-label")).toBeVisible();

    await app.getByTestId("schedule-view-month").click();
    await expect(app.getByTestId("schedule-month-label")).toContainText("2025");

    await app.getByTestId("schedule-view-year").click();
    await expect(app.getByText(/scheduled hours per day/)).toBeVisible();

    await app.getByTestId("schedule-view-week").click();
    await expect(app.getByText("Avery").first()).toBeVisible();
  });

  test("day view navigation moves the date", async ({ app }) => {
    await app.getByTestId("schedule-view-day").click();
    const first = await app.getByTestId("schedule-day-label").textContent();
    await app.getByTestId("schedule-next").click();
    await expect(app.getByTestId("schedule-day-label")).not.toHaveText(first || "");
  });
});

test.describe("@core schedule empty", () => {
  test.use({ seed: "empty" });

  test("shows the empty state when there is nothing to schedule", async ({ app }) => {
    await app.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(app.getByText(/Nothing scheduled/)).toBeVisible();
  });
});
