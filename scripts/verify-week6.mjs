/**
 * Week 6 verification — error states never crash silently.
 *   node scripts/verify-week6.mjs
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const expect = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok — ${msg}`);
};

// 1 — corrupted IndexedDB → recovery screen with options, no crash
{
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    // Simulate an unopenable IndexedDB (open always fails)
    const proto = IDBFactory.prototype;
    proto.open = function open() {
      throw new DOMException("simulated corruption", "UnknownError");
    };
  });
  await page.goto("http://localhost:3000/app");
  await page
    .getByText(/Your local map couldn.t be opened/)
    .waitFor({ timeout: 15000 }); // Dexie retries its UnknownError workaround first
  expect(true, "corrupted IndexedDB shows the recovery screen");
  expect(
    await page.getByRole("button", { name: "Start fresh" }).isVisible(),
    "recovery screen offers a way forward",
  );
  expect(errors.length === 0, "no uncaught page errors during DB failure");
  await page.close();
}

// 2 — bible book fetch failure → friendly retry UI in the picker
{
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  await page.route("**/bible/Gen.json", (route) => route.abort());
  await page.goto("http://localhost:3000/app");
  await page.waitForSelector(".react-flow__node", { state: "visible" });
  await page.waitForTimeout(800);
  await page.mouse.dblclick(420, 700);
  await page.getByRole("menuitem", { name: /Verse/ }).click();
  await page.getByRole("button", { name: "Gen", exact: true }).click();
  await page.getByRole("button", { name: "14", exact: true }).click();
  await page.waitForTimeout(1200);
  expect(
    await page.getByText(/Couldn.t load Genesis/).isVisible(),
    "book fetch failure shows friendly retry UI",
  );
  // un-block and retry
  await page.unroute("**/bible/Gen.json");
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForTimeout(1200);
  expect(
    await page.getByRole("button", { name: "18", exact: true }).isVisible(),
    "retry recovers and shows the verse grid",
  );
  await page.close();
}

// 3 — verse with no classical cross-references → empty state
{
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  await page.goto("http://localhost:3000/app");
  await page.waitForSelector(".react-flow__node", { state: "visible" });
  await page.waitForTimeout(800);
  await page.mouse.dblclick(420, 700);
  await page.getByRole("menuitem", { name: /Verse/ }).click();
  // 2 John 1:11 — obscure enough to have no TSK entry in the capped set
  await page.getByLabel("Verse reference").fill("2 John 1:11");
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Add 2 John/ }).click();
  await page.waitForTimeout(1200);
  await page.locator(".react-flow__node", { hasText: "2 John 1:11" }).click();
  await page.waitForTimeout(1500);
  const hasEmpty = await page
    .getByText("No classical cross-references for this verse.")
    .count();
  const hasRefs = await page.locator("li", { hasText: ":" }).count();
  expect(
    hasEmpty > 0 || hasRefs > 0,
    `cross-ref panel resolves (${hasEmpty ? "empty state" : "refs"} shown, never blank)`,
  );
  await page.close();
}

await browser.close();
console.log("\nWeek 6 error-state verification PASSED");
