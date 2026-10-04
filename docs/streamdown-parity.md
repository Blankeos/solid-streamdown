# React Streamdown 2.7.0 acceptance checklist

Exact target: `streamdown@2.7.0`, `vercel/streamdown` reference commit `08da224`.
Goal: 1:1 functional API/behavior compatibility with native Solid component and
JSX types, reactive props and owner-based lifecycle. The full functional surface
is implemented. This checklist distinguishes implementation evidence from final
verification and is not a declaration of exhaustive performance/security parity.

## Verified checks

Verified against the completed full-port checkout:

| Verification                                              | Result                                                |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `bun run test:run`                                        | 194 tests passed across 16 files                      |
| `bun run typecheck`, `bun run check:fix`, `bun run build` | Passed                                                |
| `bun run test:types`                                      | Built-package consumer types passed                   |
| `bun run test:browser`                                    | 18 Chromium tests passed across 9 files               |
| `bun run test:hydration`                                  | 1 separate Chromium hydration test passed             |
| `bun run test:ssr`                                        | Node SSR without browser globals passed               |
| Gittydocs 0.0.6 build                                     | 30 static routes, 30 Markdown exports and `/llms.txt` |

An isolated `npm pack` installation also verified the root exports, all four
plugin subpaths and Node SSR, without relying on this checkout’s node_modules.

The browser checks cover long-message structural rewrites, repeated-prefix reveal
sessions, provider updates, clipboard/export bytes, live fullscreen table state,
Mermaid deferral/fit/navigation, native SVG and light/dark theme styles. Hydration
uses built Node and browser entrypoints and checks retained SSR nodes, async
highlighting and portal disposal without browser errors.

## Implemented source and fixture map

Checked items are implemented and mapped to passing fixtures. These checks
verify concrete contracts; they do not establish exhaustive equivalence for every
possible extension or performance characteristic.

| Implemented surface                                                                               | Source evidence (`src/`)                                                                                                    | Fixture evidence (`test/`)                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [x] Core defaults, static/streaming modes, remend, normalization, callbacks and legacy defaults   | `stream-markdown.tsx`, `preprocess.ts`, `types.ts`                                                                          | `streamdown.test.tsx`, `stream-markdown.test.tsx`, `parser-parity.test.ts`, `create-markdown-stream.test.ts`                                     |
| [x] Raw HTML parsing, sanitation/hardening and plugin replacement                                 | `markdown-plugins.ts`, `parser.ts`                                                                                          | `parser-parity.test.ts`, `parse-markdown-tree.test.ts`                                                                                           |
| [x] Allowed/literal tags, fallback components, autolink protocols, filters and URL attributes     | `preprocess-custom-tags.ts`, `preprocess-literal-tag-content.ts`, `component-fallback.ts`, `hast-render.tsx`, `safe-url.ts` | `parser-parity.test.ts`, `composition-parity.test.tsx`, `safe-url.test.ts`, `ui-fidelity.test.tsx`                                               |
| [x] Block renderer, custom splitting, parsing memos and cross-block definitions                   | `block.tsx`, `block-incomplete-context.ts`, `utils/parse-blocks.ts`, `stream-markdown.tsx`                                  | `block-parity.test.tsx`, `parse-blocks.test.ts`, `composition-parity.test.tsx`                                                                   |
| [x] Explicit/auto semantic direction with LTR code                                                | `block-direction.ts`, `detect-direction.ts`, `code-block.tsx`                                                               | `block-parity.test.tsx`, `streamdown.test.tsx`                                                                                                   |
| [x] Default-enabled link checks/modal, async cancellation and custom Solid modal                  | `link.tsx`, `types.ts`, `streamdown-context.ts`                                                                             | `ui-parity.test.tsx`, `browser/ui-parity.spec.ts`                                                                                                |
| [x] Portal target/getter, focus restoration, scroll locking, cleanup and scoped CSS               | `portal.tsx`, `styles.css`, `ui-utils.tsx`                                                                                  | `ui-parity.test.tsx`, `ui-fidelity.test.tsx`, `browser/ui-parity.spec.ts`                                                                        |
| [x] Code/table/image/Mermaid controls, live fullscreen table, pan/zoom and exports                | `code-block.tsx`, `table.tsx`, `table-utils.ts`, `image.tsx`, `mermaid.tsx`, `feature-block.tsx`                            | `ui-parity.test.tsx`, `scheduling-parity.test.tsx`, `browser/controls.spec.ts`, `browser/ui-parity.spec.ts`, `browser/scheduling-parity.spec.ts` |
| [x] Public composables, context, icon/translation types and prefix behavior                       | `index.tsx`, `public-components.tsx`, `controls.tsx`, `streamdown-context.ts`, `ui-utils.tsx`                               | `composition-parity.test.tsx`, `ui-fidelity.test.tsx`, `typechecks/`                                                                             |
| [x] Native provider factories, custom renderer metadata and alternative-provider contracts        | `plugins/`, `plugin-types.ts`, `feature-block.tsx`                                                                          | `contracts-parity.test.tsx`, `composition-parity.test.tsx`, `streamdown.test.tsx`, `browser/plugins.spec.ts`                                     |
| [x] Reveal continuity, rewrites, reduced motion, append sessions and pinned scrolling             | `animate-plugin.ts`, `hast-render.tsx`, `pinned-scroll.ts`                                                                  | `animate-plugin.test.ts`, `streamdown.test.tsx`, `browser/reveal.spec.ts`, `browser/long-reveal.spec.ts`, `browser/session-reveal.spec.ts`       |
| [x] Async scheduling, offscreen deferral, serialized/coalesced diagrams, stale results and themes | `feature-block.tsx`, `mermaid.tsx`, `code-block.tsx`                                                                        | `scheduling-parity.test.tsx`, `ui-fidelity.test.tsx`, `browser/scheduling-parity.spec.ts`, `browser/theme-parity.spec.ts`                        |
| [x] SSR-safe public initialization and hydration fixtures                                         | `index.tsx`, `portal.tsx`, package conditional exports                                                                      | `browser/ssr-smoke.mjs`, `browser/hydration.spec.ts`, `hydration/`                                                                               |

Additional unit files cover the legacy parser, incomplete parser and safe URL
utilities: `parser.test.ts`, `parse-incomplete-markdown.test.ts`, and the mapped
files above. The 27 topic MDX pages are original Solid documentation; this
checklist, PR summary and implementation scope provide maintenance routes.

## Evidence boundaries

No comprehensive security/hydration audit or comparative performance benchmark
is claimed. Document repair/preparation and segmentation observe accumulated
input; unchanged blocks have content-keyed parsing memos, while references and
footnotes can require a document-wide parse. This is not constant-time parsing.
Source-based reveal identity is best-effort across transformed or positionless
ASTs. Async providers may finish obsolete work; stale results must not reach DOM.

Custom unified plugins/components/policies are trusted application extensions.
Replacing default processing can remove safety guarantees. Confirmation is not
sanitation or mandatory denial. Legacy URL transforms use a tag-name third
argument; direct transforms use a HAST node. Legacy omitted repair follows active
state and caret defaults on; direct repair defaults on through settled streaming
mode and caret is opt-in. Static mode suppresses repair, reveal, caret and
animation callbacks and ignores custom block splitting/rendering hooks.

See [maintenance](maintaining.mdx) for commands and pinned sources. Newly found
feasible gaps are implementation work, never deliberate framework limitations
without concrete evidence.
