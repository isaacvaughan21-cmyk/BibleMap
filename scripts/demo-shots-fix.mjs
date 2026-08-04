// Redo failed shots: 10 (toast), 11 (rail), 12 (palette), 14 (closeup) + add nested map.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(dirname(ROOT), "artifacts", "demo-video", "screenshots");
const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
});
await context.addInitScript(() => {
  window.localStorage.setItem(
    "hodos.account",
    JSON.stringify({
      email: "demo@hodos.test",
      guest: false,
      plan: "beta",
      createdAt: 0,
    }),
  );
});
const page = await context.newPage();
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("✓", name);
};

// Fresh context — re-import the demo map first
await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.locator("header button").last().click();
await page.waitForTimeout(400);
await page
  .locator('input[type="file"]')
  .setInputFiles(join(ROOT, "demo", "biblical-demo.hodos.json"));
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Replace" }).click();
await page.waitForTimeout(800);
await page.keyboard.press("Escape");
// let the "Map replaced" toast fade before the clean full-map shot
await page.waitForTimeout(4500);
await page.keyboard.press("Control+f");
await page.waitForTimeout(1500);
await shot("10-app-full-map");

// Select a VERSE node — rail auto-opens for verse selections
const verseNode = page.locator(".react-flow__node-verse").first();
console.log(
  "verse nodes:",
  await page.locator(".react-flow__node-verse").count(),
);
await verseNode.click({ position: { x: 10, y: 10 } });
await page.waitForTimeout(1500);
await shot("11-app-study-panel-crossrefs");

// Close rail via Escape, open command palette via the top-bar button
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const paletteBtn = page.getByRole("button", { name: /ctrl\s*k/i }).first();
if (await paletteBtn.isVisible().catch(() => false)) {
  await paletteBtn.click();
} else {
  await page.keyboard.press("Control+KeyK");
}
await page.waitForTimeout(700);
await page.keyboard.type("Melchizedek", { delay: 50 });
await page.waitForTimeout(700);
await shot("12-app-command-palette");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Close-up: fit, then zoom in hard at the map centre
await page.keyboard.press("Control+f");
await page.waitForTimeout(1000);
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("Control+=");
  await page.waitForTimeout(300);
}
await page.waitForTimeout(500);
await shot("14-app-node-closeup");

// Nested map: double-click a verse bubble to open it into its own map
await page.keyboard.press("Control+f");
await page.waitForTimeout(1000);
await page.locator(".react-flow__node-verse").first().dblclick();
await page.waitForTimeout(2000);
await shot("15-app-nested-map");

await browser.close();
console.log("done");
