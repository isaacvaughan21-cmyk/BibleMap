import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "warning" || m.type() === "error")
    console.log("[console]", m.type(), m.text().slice(0, 200));
});

await page.goto("http://localhost:3000/app");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(1200);

const q = page.locator(".react-flow__node", { hasText: "Who is Melchizedek?" });
const p = page.locator(".react-flow__node", { hasText: "Psalm 110:4" });
const qb = await q.boundingBox();
const pb = await p.boundingBox();
console.log("question bbox", qb);

// what's under the pointer at the bottom-center edge?
await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height / 2);
await page.waitForTimeout(300);
const probe = await page.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return {
      tag: el?.tagName,
      cls: el?.className?.toString().slice(0, 80),
      dataHandle: el?.getAttribute?.("data-handleid"),
    };
  },
  [qb.x + qb.width / 2, qb.y + qb.height - 1],
);
console.log("element at bottom-center:", probe);

await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height - 1);
await page.mouse.down();
await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height + 60, { steps: 6 });
const midState = await page.evaluate(() => ({
  connectionLine: !!document.querySelector(".react-flow__connection"),
  connectionPath: !!document.querySelector(".react-flow__connection-path"),
}));
console.log("mid-drag:", midState);
await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(400);
console.log(
  "edges after drag:",
  await page.locator(".react-flow__edge").count(),
);

await browser.close();
