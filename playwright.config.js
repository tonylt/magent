import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./artifacts/test-results",
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    viewport: { width: 240, height: 282 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173/demo/",
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
