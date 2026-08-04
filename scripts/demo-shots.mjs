// Capture demo-video screenshots of Hodos (landing + canvas app).
// Run: node scripts/demo-shots.mjs   (dev server must be on :3000)
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(dirname(ROOT), "artifacts", "demo-video", "screenshots");
const BASE = "http://localhost:3000";
const DEMO_JSON = join(ROOT, "demo", "biblical-demo.hodos.json");

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

// ---------- Landing page ----------
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("01-landing-hero");

// Scroll through the scroll-zoom story at a few depths
const scrollTo = async (frac) => {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * f, behavior: "instant" });
  }, frac);
  await page.waitForTimeout(1200);
};
await scrollTo(0.18);
await shot("02-landing-scrollzoom-problem");
await scrollTo(0.38);
await shot("03-landing-scrollzoom-how-it-works");
await scrollTo(0.58);
await shot("04-landing-features");
await scrollTo(0.78);
await shot("05-landing-live-demo");
await scrollTo(1);
await shot("06-landing-cta-footer");

// ---------- Canvas app ----------
await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("07-app-empty-state");

// Double-click create picker
await page.mouse.dblclick(860, 560);
await page.waitForTimeout(400);
await shot("08-app-create-picker");

// Verse picker
const verseItem = page.getByRole("menuitem", { name: /Verse/ });
if (await verseItem.isVisible().catch(() => false)) {
  await verseItem.click();
  await page.waitForTimeout(500);
  await page.keyboard.type("John 3:16", { delay: 60 });
  await page.waitForTimeout(800);
  await shot("09-app-verse-picker");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

// Import the rich biblical demo map via the overflow menu
await page
  .getByRole("button", { name: /more|menu|options|…/i })
  .first()
  .click()
  .catch(async () => {
    // fall back: last button in the top bar
    await page.locator("header button").last().click();
  });
await page.waitForTimeout(400);
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(DEMO_JSON);
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Replace" }).click();
await page.waitForTimeout(800);
await page.keyboard.press("Escape");

// Fit the full map
await page.keyboard.press("Control+f");
await page.waitForTimeout(1200);
await shot("10-app-full-map");

// Select a verse node and open the study panel (cross-refs)
const verseNode = page
  .locator(".react-flow__node")
  .filter({ hasText: /:/ })
  .first();
await verseNode.click();
await page.waitForTimeout(400);
await page.keyboard.press("Control+/");
await page.waitForTimeout(900);
await shot("11-app-study-panel-crossrefs");
await page.keyboard.press("Control+/");
await page.waitForTimeout(400);

// Command palette
await page.keyboard.press("Control+k");
await page.waitForTimeout(600);
await shot("12-app-command-palette");
await page.keyboard.press("Escape");

// Help / shortcuts overlay
await page.keyboard.press("?");
await page.waitForTimeout(600);
await shot("13-app-shortcuts-overlay");
await page.keyboard.press("Escape");

// Zoomed-in close-up of a cluster
await page.keyboard.press("Control+f");
await page.waitForTimeout(800);
await page.keyboard.press("Control+=");
await page.keyboard.press("Control+=");
await page.keyboard.press("Control+=");
await page.waitForTimeout(800);
await shot("14-app-node-closeup");

await browser.close();
console.log("done →", OUT);
