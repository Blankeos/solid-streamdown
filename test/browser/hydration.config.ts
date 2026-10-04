import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "hydration.spec.ts",
  use: { headless: true },
  webServer: {
    cwd: new URL("../../", import.meta.url).pathname,
    command:
      "node test/hydration/prepare.mjs && bunx vite preview --config test/hydration/vite.config.ts --outDir /tmp/solid-streamdown-hydration --port 5199",
    url: "http://localhost:5199",
    reuseExistingServer: false,
  },
});
