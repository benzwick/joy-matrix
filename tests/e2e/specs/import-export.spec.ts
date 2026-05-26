import { test, expect } from "../fixtures/base";
import { acceptNextConfirm, captureNextDialog } from "../fixtures/dialogs";
import { expectJsonDownload, importJson, importText } from "../helpers/files";
import { HEALTHY_STATE } from "../data/seeds";

test.describe("@core export", () => {
  test("exports the demo project as a dated JSON envelope", async ({ app }) => {
    const { filename, json } = await expectJsonDownload(app, () =>
      app.getByRole("button", { name: "Export project" }).click()
    );
    // Clock is frozen to 2025-06-02.
    expect(filename).toBe("joy-matrix-2025-06-02.json");
    expect(json.app).toBe("joy-matrix");
    expect(json.project.members.length).toBe(3);
  });
});

test.describe("@core import", () => {
  test.use({ seed: "empty" });

  test("imports a valid project after confirmation", async ({ app }) => {
    acceptNextConfirm(app);
    await importJson(app, "project.json", {
      app: "joy-matrix",
      schemaVersion: 5,
      project: HEALTHY_STATE,
    });
    await app.getByRole("button", { name: "Team", exact: true }).click();
    // HEALTHY_STATE carries member id m-robin.
    await expect(app.getByTestId("member-name-m-robin")).toHaveValue("Robin");
  });

  test("rejects malformed JSON with an alert", async ({ app }) => {
    const msg = captureNextDialog(app);
    await importText(app, "broken.json", "not json at all {");
    expect(await msg).toMatch(/isn't valid JSON/i);
  });

  test("rejects a file that isn't a Joy Matrix export", async ({ app }) => {
    const msg = captureNextDialog(app);
    await importJson(app, "other.json", { app: "something-else", project: {} });
    expect(await msg).toMatch(/Not an export from The Joy Matrix/i);
  });

  test("rejects an export from a newer schema version", async ({ app }) => {
    const msg = captureNextDialog(app);
    await importJson(app, "future.json", { app: "joy-matrix", schemaVersion: 99, project: {} });
    expect(await msg).toMatch(/newer version/i);
  });
});
