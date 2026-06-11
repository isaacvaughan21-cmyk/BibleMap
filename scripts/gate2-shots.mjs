/**
 * Gate 2 screenshot sequence — interaction polish.
 *   node scripts/gate2-shots.mjs [outDir]
 * Story: open → hover node → hover edge → select → multi-select →
 * box-select → context menus → tab order → empty state.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "../artifacts/gate2");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});
const shot = (name) =>
  page.screenshot({ path: resolve(outDir, `${name}.png`) });
const settle = (ms = 350) => page.waitForTimeout(ms);

const load = async () => {
  await page.goto("http://localhost:3000/app");
  await page.waitForSelector(".react-flow__node", { state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
};

await load();

// 01 — opening /app
await shot("01-open");

// 02 — hover a node (handles + lift)
const question = page.locator(".react-flow__node", {
  hasText: "Who is Melchizedek?",
});
await question.hover();
await settle();
await shot("02-hover-node");

// 03 — hover an edge (gold warm-up + endpoint caps)
await page.getByTestId("rf__edge-e-psa-heb").hover();
await settle();
await shot("03-hover-edge");

// 04 — single selection
await question.click();
await settle();
await shot("04-selected-single");

// 05 — shift-click multi-select
await page
  .locator(".react-flow__node", { hasText: "Psalm 110:4" })
  .click({ modifiers: ["Shift"] });
await settle();
await shot("05-multi-select");

// clear selection
await page.mouse.click(180, 800);
await settle();

// 06/07 — shift-drag box select (mid-drag + result)
await page.keyboard.down("Shift");
await page.mouse.move(260, 160);
await page.mouse.down();
await page.mouse.move(1240, 700, { steps: 16 });
await shot("06-box-select-drag");
await page.mouse.up();
await page.keyboard.up("Shift");
await settle();
await shot("07-box-select-result");
await page.mouse.click(180, 800);
await settle();

// 08 — node context menu
await question.click({ button: "right" });
await settle();
await shot("08-node-context-menu");
await page.keyboard.press("Escape");
await settle();

// 09 — edge context menu
await page.getByTestId("rf__edge-e-psa-heb").click({ button: "right" });
await settle();
await shot("09-edge-context-menu");
await page.keyboard.press("Escape");

// 10 — keyboard tab order (fresh load, 3 tabs → chrome focus ring)
await load();
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
await settle();
await shot("10-tab-focus");

// 11 — empty state (box-select everything, Backspace)
await page.keyboard.down("Shift");
await page.mouse.move(60, 80);
await page.mouse.down();
await page.mouse.move(1540, 860, { steps: 12 });
await page.mouse.up();
await page.keyboard.up("Shift");
await settle();
await page.keyboard.press("Backspace");
await settle(600);
await shot("11-empty-state");

await browser.close();
console.log("Saved Gate 2 screenshots to", outDir);
