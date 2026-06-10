import { expect, test } from "@playwright/test";

/** CI smoke: load /app, create a bubble, reload, assert it persists. */
test("canvas loads, creates a bubble, and persists it across reload", async ({
  page,
}) => {
  await page.goto("/app");

  // Fresh context → onboarding seed renders
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(
    page.locator(".react-flow__node", { hasText: "Who is Melchizedek?" }),
  ).toBeVisible();

  // Create a note via the double-click picker
  await page.mouse.dblclick(360, 620);
  await page.getByRole("menuitem", { name: /Note/ }).click();
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
