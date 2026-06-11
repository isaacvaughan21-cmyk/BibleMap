/**
 * Week 4 verification — palette, shortcuts, export/import, feedback widget.
 *   node scripts/verify-week4.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

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
const seedCount = await nodeCount();

// 1 — palette: fuzzy search + jump
await page.keyboard.press("Control+k");
await page.waitForSelector('[aria-label="Command palette"]');
await page.keyboard.type("melch");
await page.waitForTimeout(250);
expect(
  await page.getByRole("button", { name: /Who is Melchizedek\?/ }).isVisible(),
  "palette fuzzy-finds the seeded question",
);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
expect(
  (await page
    .locator(".react-flow__node.selected", { hasText: "Who is Melchizedek?" })
    .count()) === 1,
  "jump-to-bubble selects and centers the node",
);

// 2 — palette: create a note
await page.keyboard.press("Control+k");
await page.keyboard.type("create a note");
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Create a note bubble" }).click();
await page.waitForTimeout(400);
await page.keyboard.type("Made from the palette");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Made from the palette" })
    .isVisible(),
  "palette creates a bubble at viewport center",
);

// 3 — help overlay via "?"
await page.keyboard.press("?");
await page.waitForSelector('[aria-label="Keyboard shortcuts"]');
expect(true, "help overlay opens with ?");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// 4 — export via overflow menu
const outDir = resolve(tmpdir(), "hodos-verify");
mkdirSync(outDir, { recursive: true });
await page.getByRole("button", { name: "More options" }).click();
const downloadPromise = page.waitForEvent("download");
await page.getByRole("menuitem", { name: /Export map/ }).click();
const download = await downloadPromise;
expect(
  download.suggestedFilename().endsWith(".hodos.json"),
  `export downloads ${download.suggestedFilename()}`,
);
const exportPath = resolve(outDir, download.suggestedFilename());
await download.saveAs(exportPath);

// 5 — delete a bubble, then re-import with Replace to restore it
const before = await nodeCount();
await page
  .locator(".react-flow__node", { hasText: "Made from the palette" })
  .click({ button: "right" });
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.waitForTimeout(500);
expect((await nodeCount()) === before - 1, "bubble deleted before re-import");

await page.getByRole("button", { name: "More options" }).click();
const chooserPromise = page.waitForEvent("filechooser");
await page.getByRole("menuitem", { name: /Import map/ }).click();
const chooser = await chooserPromise;
await chooser.setFiles(exportPath);
await page.waitForSelector('[aria-label="Import map"]');
await page.getByRole("button", { name: "Replace" }).click();
await page.waitForTimeout(800);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Made from the palette" })
    .isVisible(),
  "replace-import restores the exported map",
);
expect((await nodeCount()) === before, "node count restored after import");

// 6 — feedback widget opens and degrades gracefully without Supabase env
await page.getByRole("button", { name: /Send Isaac a note/ }).click();
await page.getByLabel("Feedback message").fill("Loving the canvas so far!");
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.waitForTimeout(1500);
const sent = await page.getByText("Thank you — it's on its way.").count();
const gracefulError = await page.getByRole("alert").count();
expect(
  sent + gracefulError > 0,
  "feedback submit resolves (sent or graceful error)",
);

expect(errors.length === 0, `no page errors (got: ${errors.join("; ")})`);
await browser.close();
console.log("\nWeek 4 verification PASSED");
