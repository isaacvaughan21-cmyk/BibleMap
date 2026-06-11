/**
 * Lighthouse via Playwright's chromium (chrome-launcher can't spawn in some
 * sandboxes). Keeps a debug port open and attaches lighthouse to it.
 *   node scripts/lighthouse-run.mjs <url> <outPathNoExt>
 */
import { execSync } from "node:child_process";
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3000/app";
const out = process.argv[3] ?? "../artifacts/lighthouse-app";

const browser = await chromium.launch({
  args: ["--remote-debugging-port=9222"],
});
// Lighthouse needs an existing target to attach to.
await browser.newPage();

try {
  execSync(
    `npx --yes lighthouse "${url}" --port=9222 --output=json --output=html --output-path="${out}" --quiet`,
    { stdio: "inherit" },
  );
} finally {
  await browser.close();
}
