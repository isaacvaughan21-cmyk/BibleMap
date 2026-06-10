/** Keeps a Playwright chromium open with a CDP port for external tools. */
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  args: ["--remote-debugging-port=9222"],
});
await browser.newPage();
console.log("chrome ready on 9222");
await new Promise(() => {}); // stay alive until killed
