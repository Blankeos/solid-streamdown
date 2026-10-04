import { execFileSync } from "node:child_process";
import { writeFileSync, copyFileSync, unlinkSync } from "node:fs";
for (const args of [[], ["--ssr", "test/hydration/server.tsx"]])
  execFileSync(
    "bunx",
    ["vite", "build", "--config", "test/hydration/vite.config.ts", ...args],
    { stdio: "inherit" },
  );
// Resolve the package's node condition from inside the actual package boundary.
const server = new URL("../../.hydration-server.mjs", import.meta.url);
copyFileSync("/tmp/solid-streamdown-hydration-ssr/server.mjs", server);
writeFileSync(
  "/tmp/solid-streamdown-hydration/cached.gif",
  Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  ),
);
const { documentHtml } = await import(server.href);
writeFileSync("/tmp/solid-streamdown-hydration/index.html", documentHtml());

unlinkSync(server);
