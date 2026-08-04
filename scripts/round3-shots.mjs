// Capture review screenshots for the round-3 verse/study/highlight fixes.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.PROBE_BASE || "http://localhost:3000";
const OUT = "../artifacts/ux-round3";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
await page.addInitScript(() => {
  localStorage.setItem(
    "hodos.account",
    JSON.stringify({
      email: "shots@hodos.test",
      guest: false,
      plan: "beta",
      createdAt: Date.now(),
    }),
  );
});
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto(`${BASE}/app`);
await page.waitForSelector(".react-flow__pane", { state: "visible" });
await page.waitForTimeout(800);
await page
  .getByRole("button", { name: "Dismiss hints" })
  .click()
  .catch(() => {});
const pane = await page.locator(".react-flow__pane").boundingBox();

async function openCreate(sx, sy) {
  await page.mouse.dblclick(sx, sy);
  await page.waitForSelector('[aria-label="Create a bubble"]', {
    timeout: 3000,
  });
}
// Warm-up.
await page.mouse.dblclick(
  pane.x + pane.width / 2 + 120,
  pane.y + pane.height - 130,
);
await page.waitForSelector('[aria-label="Create a bubble"]', { timeout: 3000 });
await page.getByRole("menuitem", { name: /Definition/ }).click();
await page.waitForSelector("textarea", { timeout: 3000 });
await page.keyboard.type("grace");
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
await page.mouse.click(pane.x + 40, pane.y + 60);
await page.waitForTimeout(300);

// 1) Book picker — full names.
await openCreate(pane.x + 460, pane.y + 340);
await page.getByRole("menuitem", { name: /^Verse/ }).click();
await page.waitForSelector('input[aria-label="Verse reference"]', {
  timeout: 3000,
});
await page.waitForTimeout(250);
await shot("01-book-picker-full-names");

// 2) Verse step — Numbers grid default + toggles.
await page.locator('button[title="John"]').click();
await page.getByRole("button", { name: "3", exact: true }).click();
await page.waitForTimeout(500);
await shot("02-verse-numbers-grid-default");

// 3) Range mid-pick — first verse chosen, provisional span on hover.
await page.getByRole("button", { name: "Range" }).click();
const vcell = (n) =>
  page
    .locator(".grid-cols-8 > button")
    .filter({ hasText: new RegExp(`^${n}$`) });
await vcell(16).click();
await vcell(18).hover();
await page.waitForTimeout(250);
await shot("03-range-provisional-span");

// Commit the range, then open its study panel → Context tab.
await vcell(18).click();
await page.waitForSelector('.react-flow__node:has-text("John 3:16")', {
  timeout: 5000,
});
await page.waitForTimeout(500);
const rangeNode = page
  .locator(".react-flow__node")
  .filter({ hasText: "John 3:16" })
  .first();
const rb = await rangeNode.boundingBox();
await page.mouse.click(rb.x + rb.width / 2, rb.y + 10);
await page.waitForTimeout(800);
await page
  .getByRole("tab", { name: /Context/ })
  .click()
  .catch(() => {});
await page.waitForTimeout(900);
await shot("04-study-context-colorblind-focus");

// 5) A confirmed gold highlight + the right-click remove prompt.
await page.mouse.click(pane.x + 60, pane.y + 80); // close panel
await page.waitForTimeout(300);
await openCreate(pane.x + 260, pane.y + 360);
await page.getByRole("menuitem", { name: /^Verse/ }).click();
await page.waitForSelector('input[aria-label="Verse reference"]', {
  timeout: 3000,
});
await page.fill('input[aria-label="Verse reference"]', "John 1:1");
await page.getByRole("button", { name: /^Add John 1:1/ }).click();
await page.waitForSelector('.react-flow__node:has-text("John 1:1")', {
  timeout: 5000,
});
await page.waitForTimeout(400);
const v = page.locator('.react-flow__node:has-text("John 1:1")').first();
const vb = await v.boundingBox();
await page.mouse.click(vb.x + vb.width / 2, vb.y + 10); // select
await page.waitForTimeout(300);
await page.evaluate(() => {
  const p = document.querySelector(".react-flow__node .select-text");
  const tn = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode();
  const range = document.createRange();
  range.setStart(tn, 0);
  range.setEnd(tn, Math.min(16, tn.textContent.length));
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  p.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
});
await page.getByRole("button", { name: /^Highlight/ }).click({ timeout: 3000 });
await page.waitForTimeout(300);
await v.locator("mark.verse-mark").first().click({ button: "right" });
await page.waitForTimeout(300);
await shot("05-highlight-gold-and-remove-prompt");

console.log("shots written to", OUT);
await browser.close();
