import { defineConfig } from "@playwright/test";

/**
 * Smoke tests for the canvas. In CI the app is already built with
 * NEXT_PUBLIC_HODOS_APP_ENABLED=true; locally the dev server is reused.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
