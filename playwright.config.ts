import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  testMatch: "*.spec.ts",
  testIgnore: "hydration.spec.ts",
  webServer: {
    command:
      "bunx vite --config test/browser/vite.config.ts --port 5198 --force --strictPort",
    url: "http://localhost:5198/test/browser/",
    reuseExistingServer: false,
  },
  use: { headless: true },
});
