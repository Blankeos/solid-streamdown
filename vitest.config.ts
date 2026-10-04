import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    globals: true,
    exclude: ["test/browser/**", "node_modules/**", "dist/**"],
    environment: "jsdom",
  },
  resolve: {
    conditions: ["development", "browser"],
  },
});
