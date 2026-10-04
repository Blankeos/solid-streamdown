import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
export default defineConfig({
  plugins: [solid()],
  // Prebundle the dynamically imported chat fixture before concurrent tests load it.
  optimizeDeps: { include: ["ai", "ai-sdk-solid"] },
});
