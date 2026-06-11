import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("console", (m) =>
  console.log("[console]", m.type(), m.text().slice(0, 160)),
);
page.on("pageerror", (e) =>
  console.log("[pageerror]", String(e).slice(0, 200)),
);

await page.addInitScript(() => {
  IDBFactory.prototype.open = function open() {
    throw new DOMException("simulated corruption", "UnknownError");
  };
});

await page.goto("http://localhost:3000/app");
await page.waitForTimeout(3000);
const text = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log("BODY TEXT:", JSON.stringify(text));
await browser.close();
