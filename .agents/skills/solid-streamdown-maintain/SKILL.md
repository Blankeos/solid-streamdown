---
name: solid-streamdown-maintain
description: Maintain the native Solid Streamdown fork against React Streamdown 2.7.0; load for API, security, plugins, rendering, docs or upstream updates.
---

# Maintain Solid Streamdown

## Identity and baseline

- Maintained fork: https://github.com/Blankeos/solid-streamdown
- Current local checkout: `/Users/carlo/.herdr/experiments/solid-streamdown` (outside the usual solid-kun sibling projects).
- Original Solid upstream: https://github.com/vherbruck/solid-streamdown
- React reference: https://github.com/vercel/streamdown, **streamdown 2.7.0**, reference commit `08da224`.
- Source contracts: `packages/streamdown`, upstream plugin packages, and `apps/website/content/docs` at the pinned revision. Live https://streamdown.ai/docs/getting-started may advance.
- The manifest currently retains `solid-streamdown@1.0.1`; do not invent a published fork release or advise registry installation as fork installation.

Read root `CLAUDE.md`, `docs/streamdown-parity.md`, `docs/legacy.mdx`, and the shared react-to-solid skill before changing behavior. Scope discovery to this checkout and exact instruction paths on edited files' ancestry. Never scan parent/sibling projects recursively.

## Contract

Aim for 1:1 native Solid API/behavior compatibility with the exact target, not a React wrapper. Solid `Component`/`JSX`, reactive props, refs and portal ownership necessarily differ. Remaining gaps are implementation work, not permanent Solid limitations. The full functional surface is implemented with mapped fixtures; do not declare exhaustive performance/security parity based only on export names or passing counts. Verified baseline: 194 unit tests across 16 files, 19 Chromium tests, 1 separate hydration test, built-package consumer types and Node SSR. Record fresh results after every update; historical counts are not current evidence.

Preserve legacy content/stream precedence, repair-while-active defaults, caret default, stream accessors and URL callback shape. Keep direct Streamdown defaults distinct. Native provider imports are `solid-streamdown/{code,math,cjk,mermaid}`; component-valued contracts must be Solid. Do not add React runtime peers to compensate for an unfinished port.

## Update procedure

1. Confirm the pinned upstream version and diff source, declarations, tests and docs before translating. Record new baseline explicitly rather than following latest accidentally.
2. Inventory props, exports, default pipelines, controls, translations/icons and observable browser behavior. Use the acceptance checklist to expose missing work.
3. Preserve reactive AST/component props and source-origin metadata through rewrites. Solid bodies run once; do not capture changing props in snapshots.
4. External async callbacks need captured owner and stale-result guards. SSR/browser fallback and disposal are part of correctness, not cleanup polish.
5. Validate default raw HTML sanitation/hardening and replacement plugin semantics. Element filters, URL checks, modal confirmation and Mermaid SVG sanitation are different boundaries. Trusted callbacks can bypass default safety.
6. Check built conditional exports and symbols in Node SSR as well as browser/Solid compilation. Never import browser globals during server initialization.
7. Keep documentation wording and structure close to upstream. Reuse upstream wording where accurate; change only what Solid APIs, package names or installation require. Avoid unnecessary paraphrasing. Retain MIT plus Apache-2.0 notices (`LICENSE-STREAMDOWN`, `ATTRIBUTION.md`) and credit adapted documentation.
8. Capture reusable translation lessons in the shared react-to-solid resources, not library-specific rules there.

## Required verification

```bash
bun run check:fix
bun run typecheck
bun run test:run
bun run build
bun run test:types
bun run test:ssr
bun run test:browser
bun run test:hydration
bun run docs:build
```

Install Playwright Chromium if absent: `bunx playwright install chromium`. Run a built-package Node SSR smoke check without browser globals, then hydration/browser fixtures separately. Record commands, exact counts/outcomes, source revision and unverified cases. Historical counts in docs are not current evidence. Run formatter with ownership coordination: it touches multiple files.

Test append streams, settled incomplete input, static aliases, list/table/reference rewrites, reactive component replacement, disposal while async work is pending, reduced motion, controls/scroll, RTL semantics, portal focus/cleanup and hostile HTML/URLs. Load the project's test-authoring skill before writing tests when available.

## Docs and integration

Docs are `.mdx` plus `docs/gittydocs.jsonc`, using published Gittydocs **0.0.7**. No hand-built app, domain invention or deployment without authorization. `bun run docs:dev` and `bun run docs:build` wrap the pinned CLI. The build writes ignored `.docs-dist/`, outside published `dist/`; `bunx gittydocs@0.0.7 build ./docs --out /tmp/solid-streamdown-docs-v7` is an isolated-output alternative. Use the published runtime rather than a local framework link.

The official Gittydocs docs are the authority; if live cached docs lag, consult the official source docs (currently `/Users/carlo/Desktop/projects/gittydocs/docs`). Read `components/tabs.mdx`, `components/type-table.mdx` and `components/auto-type-table.mdx` before changing those elements. `Tabs`, `Tab` and `TypeTable` are import-free. Use string `items` with matching `Tab value`s; package-manager groups share `groupId="package-manager" persist` and meaningful accessible `label`s. Keep blank lines around Markdown in each panel. Show npm/pnpm/Bun application commands without claiming registry availability for this fork; clone/build/link still requires Bun for library scripts.

Use manual literal `TypeTable type={{ ... }}` maps with string types/defaults/descriptions, grouped by meaningful API areas. Check all rows against actual exported declarations and native runtime defaults, including inherited pipeline props and animation callbacks. Omitted optional values need no fabricated default or required badge. Literal maps preserve property descriptions/defaults in Markdown exports and `/llms.txt`. `AutoTypeTable` restricts source paths to the docs content root, so `../src/types.ts` is unsupported. Do not scaffold duplicate TypeScript declarations merely to enable automatic tables. Verify all static routes, exported map fields and tab commands, plus keyboard/disclosure behavior in the built site. For docs-only changes format only owned Markdown/MDX/skill files, not the source-rewriting global formatter.

Use `bun install`, `bun run build`, `bun link` in the fork, then `bun link solid-streamdown` in a consumer for local development. Reproducible consumers must pin a reviewed commit and integrate a built artifact; do not assume Git installs build `dist` automatically.
