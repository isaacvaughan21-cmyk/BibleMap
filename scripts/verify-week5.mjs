/**
 * Week 5 verification — verse picker, BSB text, TSK cross-ref panel.
 *   node scripts/verify-week5.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "../artifacts/week5");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const expect = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok — ${msg}`);
};

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1000);

// 1 — create a verse bubble: picker opens automatically
await page.mouse.dblclick(420, 700);
await page.getByRole("menuitem", { name: /Verse/ }).click();
await page.waitForSelector('[aria-label="Choose a verse"]');
expect(true, "creating a verse bubble opens the verse picker");

// 2 — free-text resolution: John 3:16
await page.getByLabel("Verse reference").fill("John 3:16");
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Add John 3:16" }).click();
await page.waitForTimeout(1200);
const john = page.locator(".react-flow__node", { hasText: "John 3:16" });
expect(await john.isVisible(), "John 3:16 bubble created via free text");
expect(
  await page
    .locator(".react-flow__node", { hasText: "For God so loved the world" })
    .isVisible(),
  "BSB text filled into the bubble",
);

// 3 — selecting the verse opens the cross-ref panel
await john.click();
await page.waitForTimeout(800);
expect(
  await page.getByText("CROSS-REFERENCES", { exact: true }).isVisible(),
  "study rail auto-opens with cross-references",
);

// 4 — add Romans 5:8 from the panel
const romansRow = page.locator("li", { hasText: "Romans 5:8" }).first();
await romansRow.scrollIntoViewIfNeeded();
await romansRow.hover();
await romansRow.getByRole("button", { name: /Add to canvas/ }).click();
await page.waitForTimeout(1200);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Romans 5:8" })
    .isVisible(),
  "Romans 5:8 bubble added from the panel",
);
expect(
  (await page.locator(".react-flow__edge .hodos-edge-crossref").count()) >= 1,
  "gold dashed crossref edge connects the two verses",
);

// 5 — grid navigation: Genesis 14:18 via book → chapter → verse
await page.mouse.click(150, 780); // clear selection on empty pane
await page.waitForTimeout(300);
await page.mouse.dblclick(150, 780);
await page.getByRole("menuitem", { name: /Verse/ }).click();
await page.waitForSelector('[aria-label="Choose a verse"]');
await page.getByRole("button", { name: "Gen", exact: true }).click();
await page.getByRole("button", { name: "14", exact: true }).click();
await page.getByRole("button", { name: "18", exact: true }).click();
await page.waitForTimeout(1200);
expect(
  (await page
    .locator(".react-flow__node", { hasText: "brought out bread and wine" })
    .count()) >= 1,
  "grid navigation lands on Genesis 14:18 with correct BSB text",
);

// 6 — persistence
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(800);
expect(
  await page.locator(".react-flow__node", { hasText: "John 3:16" }).isVisible(),
  "verse bubbles persist after refresh",
);

await page.screenshot({ path: resolve(outDir, "week5-final.png") });
expect(errors.length === 0, `no page errors (got: ${errors.join("; ")})`);
await browser.close();
console.log("\nWeek 5 verification PASSED");
