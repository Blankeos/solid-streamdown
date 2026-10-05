import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [solid({ ssr: true, solid: { hydratable: true } })],
  resolve: {
    alias: isSsrBuild
      ? []
      : [
          {
            find: /^@blankeos\/solid-streamdown$/,
            replacement: resolve("dist/index/index.js"),
          },
        ],
  },
  ssr: {
    external: ["@blankeos/solid-streamdown", "@blankeos/solid-streamdown/code"],
  },
  build: {
    outDir: isSsrBuild
      ? "/tmp/solid-streamdown-hydration-ssr"
      : "/tmp/solid-streamdown-hydration",
    emptyOutDir: true,
    rollupOptions: {
      input: isSsrBuild
        ? "test/hydration/server.tsx"
        : "test/hydration/client.tsx",
      output: {
        entryFileNames: isSsrBuild ? "server.mjs" : "assets/client.js",
      },
    },
  },
}));
