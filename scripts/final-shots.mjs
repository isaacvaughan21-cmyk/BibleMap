/**
 * Final report screenshots — the full product story at 1x for review.
 *   node scripts/final-shots.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "../artifacts/final");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const shot = (name) =>
  page.screenshot({ path: resolve(outDir, `${name}.png`) });

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
await shot("01-first-visit-seed");

// Build the gate-5 study scene: John 3:16 + cross-ref panel + Romans 5:8
await page.mouse.dblclick(380, 680);
await page.getByRole("menuitem", { name: /Verse/ }).click();
await page.getByLabel("Verse reference").fill("John 3:16");
await page.getByRole("button", { name: "Add John 3:16" }).click();
await page.waitForTimeout(1200);
const john = page.locator(".react-flow__node", { hasText: "John 3:16" });
await john.click();
await page.waitForTimeout(900);
await shot("02-crossref-panel");

const romansRow = page.locator("li", { hasText: "Romans 5:8" }).first();
await romansRow.scrollIntoViewIfNeeded();
await romansRow.hover();
await romansRow.getByRole("button", { name: /Add to canvas/ }).click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Fit map to view" }).click();
await page.waitForTimeout(900);
await shot("03-study-scene");

// Command palette with content
await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await shot("04-palette-recent");
await page.keyboard.press("Escape");

// Help overlay
await page.keyboard.press("?");
await page.waitForTimeout(400);
await shot("05-shortcuts");
await page.keyboard.press("Escape");

// Feedback composer
await page.getByRole("button", { name: /Send Isaac a note/ }).click();
await page.waitForTimeout(400);
await shot("06-feedback");
await page.keyboard.press("Escape");

// Synthetic 300/500 fit view (perf scene)
await page.goto("http://localhost:3000/app?synthetic=300&edges=500");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1500);
await shot("07-synthetic-300-500");

await browser.close();
console.log("Saved final screenshots to", outDir);
