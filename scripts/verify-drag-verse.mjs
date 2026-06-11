/**
 * Verify dragging a cross-reference from the study panel onto the canvas
 * places a verse bubble at the drop point.
 *   node scripts/verify-drag-verse.mjs
 */
import { chromium } from "@playwright/test";

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

// Make a John 3:16 verse and open its cross-ref panel
await page.mouse.dblclick(420, 680);
await page.getByRole("menuitem", { name: /Verse/ }).click();
await page.getByLabel("Verse reference").fill("John 3:16");
await page.getByRole("button", { name: "Add John 3:16" }).click();
await page.waitForTimeout(1200);
await page.locator(".react-flow__node", { hasText: "John 3:16" }).click();
await page.waitForTimeout(900);

const before = await nodeCount();
const row = page.locator("li", { hasText: "Romans 5:8" }).first();
await row.scrollIntoViewIfNeeded();
const rb = await row.boundingBox();

// HTML5 drag-and-drop: dispatch the native sequence with a shared DataTransfer
const dropX = 700;
const dropY = 300;
await page.evaluate(
  async ({ sx, sy, dx, dy }) => {
    const dt = new DataTransfer();
    const from = document
      .elementFromPoint(sx, sy)
      .closest("li[draggable='true']");
    const to = document.querySelector(".react-flow__pane");
    const fire = (el, type, clientX, clientY) =>
      el.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX,
          clientY,
        }),
      );
    fire(from, "dragstart", sx, sy);
    fire(to, "dragenter", dx, dy);
    fire(to, "dragover", dx, dy);
    fire(to, "drop", dx, dy);
    fire(from, "dragend", dx, dy);
  },
  { sx: rb.x + rb.width / 2, sy: rb.y + 14, dx: dropX, dy: dropY },
);
await page.waitForTimeout(1200);

expect(
  (await nodeCount()) === before + 1,
  "drag-drop created one verse bubble",
);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Romans 5:8" })
    .isVisible(),
  "dropped bubble is Romans 5:8",
);
expect(
  (await page.locator(".react-flow__edge .hodos-edge-crossref").count()) >= 1,
  "a gold dashed crossref edge connects the two",
);

// dropped near the drop point (not the default offset to the right of source)
const dropped = await page
  .locator(".react-flow__node", { hasText: "Romans 5:8" })
  .boundingBox();
expect(
  Math.abs(dropped.x + dropped.width / 2 - dropX) < 220 &&
    Math.abs(dropped.y + dropped.height / 2 - dropY) < 220,
  "bubble landed near the drop point",
);

// persists
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(800);
expect(
  await page
    .locator(".react-flow__node", { hasText: "Romans 5:8" })
    .isVisible(),
  "dropped verse persists across reload",
);

expect(errors.length === 0, `no page errors (got: ${errors.join("; ")})`);
await browser.close();
console.log("\nDrag-verse verification PASSED");
