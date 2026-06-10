/**
 * Verify the infinite-zoom nested maps: open a bubble into its own map,
 * build inside it, navigate via breadcrumb, persistence, child indicator.
 *   node scripts/verify-nested-maps.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "../artifacts/nested");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
// Fresh profile so we exercise seed + migration from empty.
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const expect = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok — ${msg}`);
};
const nodeCount = () => page.locator(".react-flow__node").count();
const shot = (n) => page.screenshot({ path: resolve(outDir, `${n}.png`) });

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1200);
await shot("01-root");

// Open the question bubble into its own map by double-clicking it
const q = page.locator(".react-flow__node", { hasText: "Who is Melchizedek?" });
await q.dblclick({ force: true });
await page.waitForTimeout(2400); // cinematic dive transition

// Child map: one anchor bubble mirroring the question
expect(
  (await nodeCount()) === 1,
  "child map opens with one isolated anchor bubble",
);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Who is Melchizedek?" })
    .isVisible(),
  "anchor mirrors the opened bubble",
);
expect(
  await page.getByLabel("Map breadcrumb").isVisible(),
  "breadcrumb appears when nested",
);
await shot("02-child-opened");

// Build inside the child map
await page.mouse.dblclick(900, 360);
await page.getByRole("menuitem", { name: /Note/ }).click();
await page.waitForTimeout(400);
await page.keyboard.type("A thought that only lives inside this bubble");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
expect((await nodeCount()) === 2, "can add bubbles inside the child map");
await shot("03-child-built");

// Go back to root via breadcrumb back button
await page.getByRole("button", { name: "Back one level" }).click();
await page.waitForTimeout(2200);
expect((await nodeCount()) === 3, "back at the root map (3 seeded bubbles)");
expect(
  (await page
    .locator(".react-flow__node", { hasText: "only lives inside" })
    .count()) === 0,
  "child-map content does not leak into the root",
);

// The opened bubble now shows the child-map indicator (open button lit)
const q2 = page.locator(".react-flow__node", {
  hasText: "Who is Melchizedek?",
});
expect(
  await q2.getByRole("button", { name: "Enter map" }).isVisible(),
  "opened bubble shows the 'enter map' indicator",
);
await shot("04-back-at-root");

// Re-enter via double-click: child content is still there (no reseed)
await q2.dblclick({ force: true });
await page.waitForTimeout(2400);
expect(
  await page
    .locator(".react-flow__node", { hasText: "only lives inside" })
    .isVisible(),
  "re-entering shows the previously built child map",
);
expect((await nodeCount()) === 2, "child map kept both bubbles (no reseed)");

// Persist across a hard refresh (starts back at root, child intact)
await page.waitForTimeout(900);
await page.reload();
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1000);
expect((await nodeCount()) === 3, "reload returns to the root map");
const q3 = page.locator(".react-flow__node", {
  hasText: "Who is Melchizedek?",
});
// The lit badge is the secondary entrance — exercise it too
await q3.getByRole("button", { name: "Enter map" }).click({ force: true });
await page.waitForTimeout(2400);
expect(
  await page
    .locator(".react-flow__node", { hasText: "only lives inside" })
    .isVisible(),
  "child map survived a hard refresh",
);

expect(
  errors.filter((e) => !e.includes("insights")).length === 0,
  `no page errors (got: ${errors.join("; ")})`,
);
await browser.close();
console.log("\nNested-maps verification PASSED");
