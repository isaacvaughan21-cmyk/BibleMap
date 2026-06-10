/**
 * Review-gate screenshot harness.
 * Captures the /app canvas in the states a review gate asks for.
 *
 *   node scripts/gate-shots.mjs [outDir]
 *
 * Requires the dev server on http://localhost:3000 with
 * NEXT_PUBLIC_HODOS_APP_ENABLED=true.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "../artifacts/gate1");
mkdirSync(outDir, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: resolve(outDir, `${name}.png`) });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200); // fitView + font swap settle

// 1 — default zoom, sample layout
await shot(page, "01-default");

// 2 — hover a node (handles + shadow affordance)
await page
  .locator(".react-flow__node", { hasText: "Who is Melchizedek?" })
  .hover();
await page.waitForTimeout(350);
await shot(page, "02-hover-question");

// 3 — selected node (gold halo)
await page
  .locator(".react-flow__node", { hasText: "Who is Melchizedek?" })
  .click();
await page.waitForTimeout(350);
await shot(page, "03-selected-question");
await page.keyboard.press("Escape");

// 4 — zoom out to ~25%
const readZoom = async () => {
  const label = await page
    .locator('button[aria-label*="click to reset"]')
    .textContent();
  return parseFloat(label);
};
await page.mouse.move(800, 470);
for (let i = 0; i < 40; i++) {
  const pct = await readZoom();
  if (pct <= 25.4) break;
  await page.mouse.wheel(0, pct > 36 ? 240 : 40);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(400);
console.log("zoom for 25% shot:", await readZoom(), "%");
await shot(page, "04-zoom-25");

// 5 — back to fit, open the study rail
await page.locator('button[aria-label="Fit map to view"]').click();
await page.waitForTimeout(700);
await page.locator('button[aria-label="Open study panel"]').click();
await page.waitForTimeout(500);
await shot(page, "05-rail-open");
await page.locator('button[aria-label="Close study panel"]').click();
await page.waitForTimeout(500);

// 6 — command palette (Ctrl+K)
await page.keyboard.press("Control+k");
await page.waitForTimeout(450);
await shot(page, "06-command-palette");

await browser.close();
console.log("Saved screenshots to", outDir);
