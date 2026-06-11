/**
 * Verification for the polish round: map rename, right-click create,
 * restore-after-delete, duplicate, first-run hints.
 *   node scripts/verify-improvements.mjs
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const expect = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok — ${msg}`);
};
const nodeCount = () => page.locator(".react-flow__node").count();

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1000);

// 1 — first-run hint bar shows on a fresh profile
expect(
  await page.getByText("to create").isVisible(),
  "hint bar shows on first visit",
);

// 2 — rename the map, persists across reload
await page.getByRole("button", { name: "Untitled map" }).click();
await page.getByLabel("Map name").fill("Melchizedek Study");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
expect(
  await page.getByRole("button", { name: /Melchizedek Study/ }).isVisible(),
  "map renamed inline",
);
expect(
  (await page.title()).includes("Melchizedek Study"),
  "tab title follows the map name",
);

// 3 — right-click empty canvas opens the create picker
await page.mouse.click(420, 700, { button: "right" });
await page.waitForSelector('[aria-label="Create a bubble"]');
expect(true, "right-click on canvas opens the create picker");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// 4 — delete then restore
const before = await nodeCount();
await page
  .locator(".react-flow__node", { hasText: "Genesis 14:18" })
  .click({ button: "right" });
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.waitForTimeout(500);
expect((await nodeCount()) === before - 1, "bubble deleted");
await page.getByRole("button", { name: "Restore" }).click();
await page.waitForTimeout(500);
expect((await nodeCount()) === before, "restore brings the bubble back");
expect(
  await page
    .locator(".react-flow__node", { hasText: "Genesis 14:18" })
    .isVisible(),
  "restored bubble has its content",
);

// restored data survives reload (resurrected in Dexie too)
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(800);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Genesis 14:18" })
    .isVisible(),
  "restored bubble survives a hard refresh",
);
expect(
  await page.getByRole("button", { name: /Melchizedek Study/ }).isVisible(),
  "map name survives a hard refresh",
);

// 5 — duplicate a bubble
const n2 = await nodeCount();
await page
  .locator(".react-flow__node", { hasText: "Who is Melchizedek?" })
  .click({ button: "right" });
await page.getByRole("menuitem", { name: "Duplicate" }).click();
await page.waitForTimeout(500);
expect((await nodeCount()) === n2 + 1, "duplicate adds a copy");
expect(
  (await page
    .locator(".react-flow__node", { hasText: "Who is Melchizedek?" })
    .count()) === 2,
  "copy carries the content",
);

// 6 — dismiss hints, stays dismissed
await page.getByRole("button", { name: "Dismiss hints" }).click();
await page.waitForTimeout(600);
await page.reload();
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(800);
expect(
  (await page.getByText("to create").count()) === 0,
  "hints stay dismissed after reload",
);

expect(errors.length === 0, `no page errors (got: ${errors.join("; ")})`);
await browser.close();
console.log("\nImprovement verification PASSED");
