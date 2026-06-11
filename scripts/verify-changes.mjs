// Headless verification for the three landing/app changes.
// Run with the dev server up: node scripts/verify-changes.mjs [port]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "artifacts", "changes");
mkdirSync(OUT, { recursive: true });

const PORT = process.argv[2] || "3001";
const BASE = `http://localhost:${PORT}`;
const shot = (page, name) =>
  page.screenshot({ path: join(OUT, `${name}.png`) });

const browser = await chromium.launch();

/* ---------- 1+2: Live demo dive-in (desktop) ---------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#try`, { waitUntil: "networkidle" });
  await page.locator("#try").scrollIntoViewIfNeeded();
  await page.waitForSelector(".react-flow__node", { state: "visible" });
  await page.waitForTimeout(900);
  await shot(page, "01-livedemo-root");

  // The expandable verse carries the "Double-click me" badge.
  const badge = page.getByText("Double-click me", { exact: true });
  const hasBadge = (await badge.count()) > 0;
  console.log("Double-click me badge present:", hasBadge);

  // Dive into the Hebrews 7:3 verse bubble.
  const verse = page
    .locator(".react-flow__node", { hasText: "Hebrews 7:3" })
    .first();
  await verse.dblclick();
  await page.waitForTimeout(1900); // cinematic plunge + settle
  const backVisible = await page.getByText("BACK TO THE MAP").isVisible();
  const crumbVisible = await page.getByText("INSIDE · Hebrews 7:3").isVisible();
  const branchVerse = await page
    .locator(".react-flow__node", { hasText: "Hebrews 7:4" })
    .count();
  console.log("Back pill visible:", backVisible);
  console.log("Depth crumb visible:", crumbVisible);
  console.log("Branch bubble (Heb 7:4) count:", branchVerse);
  await shot(page, "02-livedemo-branch");

  await page.getByText("BACK TO THE MAP").click();
  await page.waitForTimeout(1900); // cinematic rise-out + settle
  const backRoot = await page
    .getByText("Double-click me", { exact: true })
    .count();
  console.log("Returned to root (badge back):", backRoot > 0);
  await shot(page, "03-livedemo-back-to-root");
  await ctx.close();
}

/* ---------- 3: Mobile + desktop banner ---------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const bannerVisible = await page
    .getByText("best explored on desktop.")
    .isVisible();
  console.log("Mobile desktop-hint banner visible:", bannerVisible);
  await shot(page, "04-mobile-hero-banner");

  await page.locator("#try").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, "05-mobile-livedemo");
  await ctx.close();
}

/* ---------- 1: WelcomeGate guest button (app) ---------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const guestBtn = page.getByRole("button", { name: /Continue as guest/i });
  const guestVisible = await guestBtn.isVisible();
  console.log("Continue as guest button visible:", guestVisible);
  await shot(page, "06-welcomegate-guest");

  // Guest path actually enters the canvas.
  await guestBtn.click();
  await page.waitForTimeout(900);
  const gateGone = (await page.getByRole("dialog").count()) === 0;
  console.log("Gate dismissed after guest entry:", gateGone);
  await shot(page, "07-app-after-guest");
  await ctx.close();
}

await browser.close();
console.log("\nScreenshots →", OUT);
