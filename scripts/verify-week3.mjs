/**
 * Week 3 mechanics verification — create / edit / connect / delete / persist.
 * Run against a fresh browser context (clean IndexedDB) so seeding is exercised.
 *   node scripts/verify-week3.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "../artifacts/week3");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const nodeCount = () => page.locator(".react-flow__node").count();
const edgeCount = () => page.locator(".react-flow__edge").count();
const expect = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok — ${msg}`);
};

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1200);

// 1 — onboarding seed on a fresh profile
expect(
  (await nodeCount()) === 3,
  "fresh profile seeds 3-bubble Melchizedek arc",
);
expect((await edgeCount()) === 2, "seed has 2 manual edges");

// 2 — create a question via double-click picker
await page.mouse.dblclick(420, 700);
await page.waitForSelector('[aria-label="Create a bubble"]');
await page.getByRole("menuitem", { name: /Question/ }).click();
await page.waitForTimeout(300);
await page.keyboard.type("What is faith?");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
expect(
  await page
    .locator(".react-flow__node", { hasText: "What is faith?" })
    .isVisible(),
  "question created and edited via inline editor",
);

// 3 — create a note
await page.mouse.dblclick(1000, 720);
await page.waitForSelector('[aria-label="Create a bubble"]');
await page.getByRole("menuitem", { name: /Note/ }).click();
await page.waitForTimeout(300);
await page.keyboard.type("Faith is assurance of what we hope for.");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
expect((await nodeCount()) === 5, "two new bubbles exist (5 total)");

// 4 — connect question → note by dragging handle to handle
const q = page.locator(".react-flow__node", { hasText: "What is faith?" });
const n = page.locator(".react-flow__node", { hasText: "Faith is assurance" });
const qb = await q.boundingBox();
const nb = await n.boundingBox();
await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height / 2);
await page.waitForTimeout(250); // reveal handles
await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height - 1);
await page.mouse.down();
await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(400);
expect(
  (await edgeCount()) === 3,
  "handle-drag created a manual edge (3 total)",
);

// 5 — delete a seeded verse via context menu (cascades its edge)
await page
  .locator(".react-flow__node", { hasText: "Genesis 14:18" })
  .click({ button: "right" });
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.waitForTimeout(400);
expect((await nodeCount()) === 4, "node deleted via context menu");
expect((await edgeCount()) === 2, "connected edge cascade-deleted");

// 6 — hard refresh → everything persists
await page.waitForTimeout(800); // let the debounced flush land
await page.reload();
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1000);
expect((await nodeCount()) === 4, "nodes persist after hard refresh");
expect((await edgeCount()) === 2, "edges persist after hard refresh");
expect(
  await page
    .locator(".react-flow__node", { hasText: "What is faith?" })
    .isVisible(),
  "edited content persisted",
);
expect(
  (await page
    .locator(".react-flow__node", { hasText: "Genesis 14:18" })
    .count()) === 0,
  "deleted node stays deleted",
);

await page.screenshot({ path: resolve(outDir, "week3-final.png") });
expect(errors.length === 0, `no page errors (got: ${errors.join("; ")})`);

await browser.close();
console.log("\nWeek 3 verification PASSED. Screenshot:", outDir);
