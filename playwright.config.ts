import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  testMatch: "*.spec.ts",
  webServer: {
    command: "bunx vite --config test/browser/vite.config.ts --port 5198",
    url: "http://localhost:5198/test/browser/",
    reuseExistingServer: true,
  },
  use: { headless: true },
});
