/**
 * Perf trace — loads the synthetic 300-node / 500-edge stress map and
 * measures frame rate during continuous zoom and pan.
 * Run against a PRODUCTION server:  node scripts/perf-trace.mjs
 */
import { chromium } from "@playwright/test";

// Headless chromium uses software rendering (SwiftShader) and understates
// real-hardware FPS — set PERF_HEADED=1 for a GPU-accurate measurement.
const browser = await chromium.launch({
  headless: process.env.PERF_HEADED !== "1",
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

await page.goto("http://localhost:3000/app?synthetic=300&edges=500");
await page.waitForSelector(".react-flow__node", { state: "visible" });
await page.waitForTimeout(2000);

const totals = await page.evaluate(() => ({
  renderedNodes: document.querySelectorAll(".react-flow__node").length,
  renderedEdges: document.querySelectorAll(".react-flow__edge").length,
}));
console.log(
  `synthetic map loaded — DOM nodes rendered: ${totals.renderedNodes} bubbles, ${totals.renderedEdges} edges (virtualized from 300/500)`,
);

const measureFps = (durationMs) =>
  page.evaluate(
    (dur) =>
      new Promise((res) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = (t) => {
          frames++;
          if (t - t0 < dur) requestAnimationFrame(tick);
          else res(frames / ((t - t0) / 1000));
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );

// 1 — zoom stress: continuous wheel in/out over the canvas
await page.mouse.move(800, 450);
let fpsPromise = measureFps(3000);
for (let i = 0; i < 28; i++) {
  await page.mouse.wheel(0, i % 8 < 4 ? -140 : 140);
  await page.waitForTimeout(95);
}
const zoomFps = await fpsPromise;

// 2 — pan stress: drag the pane in circles
fpsPromise = measureFps(3000);
for (let lap = 0; lap < 3; lap++) {
  await page.mouse.move(800, 450);
  await page.mouse.down();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    await page.mouse.move(800 + Math.cos(a) * 260, 450 + Math.sin(a) * 160);
    await page.waitForTimeout(45);
  }
  await page.mouse.up();
}
const panFps = await fpsPromise;

console.log(`zoom FPS: ${zoomFps.toFixed(1)}`);
console.log(`pan  FPS: ${panFps.toFixed(1)}`);
console.log(zoomFps >= 55 && panFps >= 55 ? "PASS (≥55fps)" : "BELOW TARGET");

await browser.close();
