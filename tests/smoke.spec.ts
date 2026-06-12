import { expect, test } from "@playwright/test";

/** CI smoke: load /app, create a bubble, reload, assert it persists. */
test("canvas loads, creates a bubble, and persists it across reload", async ({
  page,
}) => {
  // Pre-seed a beta account so the WelcomeGate doesn't cover the canvas.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "hodos.account",
      JSON.stringify({
        email: "ci@hodos.test",
        guest: false,
        plan: "beta",
        createdAt: 0,
      }),
    );
  });
  await page.goto("/app");

  // New users start on a blank canvas (no sample seed) — the empty state shows.
  await expect(page.getByText("Double-click anywhere to begin")).toBeVisible();

  // Create a note via the double-click picker
  await page.mouse.dblclick(360, 620);
  await page.getByRole("menuitem", { name: /Note/ }).click();
  await page.waitForTimeout(500); // editor focuses once React Flow measures
  await page.keyboard.type("smoke test note");
  await page.keyboard.press("Escape");
  await expect(
    page.locator(".react-flow__node", { hasText: "smoke test note" }),
  ).toBeVisible();

  // Let the debounced flush write to IndexedDB, then hard-reload
  await page.waitForTimeout(900);
  await page.reload();
  await expect(
    page.locator(".react-flow__node", { hasText: "smoke test note" }),
  ).toBeVisible();
});
