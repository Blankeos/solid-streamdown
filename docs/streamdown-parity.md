# Solid Streamdown compatibility

Reference: React Streamdown 2.7.0, commit `08da224`. This is a supported core
interface and feature-plugin subset, not full API/UI/security/performance parity.

## Implemented

- Native `Streamdown` with reactive string `children`, `class` / `className`,
  streaming/static modes, `isAnimating`, animation callbacks, `animated`,
  caret `block` / `circle`, remark/rehype plugins, and Solid component overrides.
- Defaults: streaming mode, incomplete repair on, animating off, animation off,
  caret absent. Static disables repair, animation, caret, and callbacks.
- Structural feature plugins: Shiki async dual-theme tokens, KaTeX, CJK
  before/after-GFM transforms, Mermaid async rendering, custom language renderers.
  Native exports are `solid-streamdown/{code,math,cjk,mermaid}`, including factory
  functions. Runtime dependencies include Shiki, KaTeX, Mermaid and CJK transforms;
  separate entry points do not make those npm dependencies optional.
- Actual published `@streamdown/code@2.0.0`, math/cjk/mermaid `1.0.3` objects
  exercised in jsdom and Chromium. These packages declare React peers but their
  factories do not use React at runtime. Native plugin subpaths avoid that peer.
- `StreamMarkdown` and `createMarkdownStream` remain supported; the legacy
  repair-while-active and caret defaults remain unchanged. Both components use
  one private core; neither mounts or composes the other's DOM.
- Async code and diagram completions are invalidated on update/unmount.
  Mermaid is client-only, uses unique per-request render IDs, sanitizes returned
  SVG with DOMPurify, and displays source while pending/on the server.
- Consumers import `katex/dist/katex.min.css`; it is not silently injected.
  The renderer does not call math `getStyles`. CJK uses `remarkPluginsBefore` /
  `remarkPluginsAfter`, not the deprecated combined `remarkPlugins` array.
  Custom renderers receive code, language, meta and incomplete state and must be
  Solid components. A `pre` override bypasses built-in feature rendering.
- Explicit ltr/rtl use native `dir`; code remains ltr. Native `auto` differs from
  React's majority-based per-semantic-block direction resolution.

## Deliberate limitations / not full parity

- No built-in copy/download/fullscreen/pan-zoom controls, table controls, sticky
  scrolling/max-height, export actions, translations, icons, or portal overlays.
  These props are not advertised as implemented.
- No link safety confirmation modal, raw HTML processing, custom allowed tags,
  HTML indentation normalization, literal tags, element filtering, autolink
  protocol configuration, custom BlockComponent, or configurable block splitting.
  The existing URL transform receives a tag-name string, not React's HAST node.
- Raw HTML remains disabled by default. URL filtering is not a full HTML sanitizer;
  user-supplied rehype plugins/component overrides are trusted extensions.
  Mermaid SVG sanitation preserves foreignObject labels, removes script/event
  attributes, and is separate from the Markdown URL policy. Trusted plugin
  token styles/attributes are passed through. No claim of identical React security.
  URL policy covers anchors and images only. Custom URL transforms and
  `remarkRehypeOptions` are trusted escape hatches; unified processing is
  synchronous (`runSync`), not an async plugin pipeline.
- Mermaid rendering already begun is not abortable in its upstream interface;
  stale completions are ignored, but rendering still consumes work. Mermaid
  bindFunctions are not invoked. Core Mermaid errorComponent is not implemented.
- Animation uses absolute schedules and HAST source-position identities, with a
  rendered-offset fallback for positionless trees. Tested appends and structural
  list/table/reference rewrites no longer restart completed reveals on reinsertion.
  Source identity is best-effort: decoded/transformed text, missing positions, and
  changes to existing text ancestors can change identity or remount spans. No
  blanket guarantee of continuity through all Markdown formatting rewrites.
  The roughly 5.4 KB Chromium guide fixture checks observed characters older than
  850 ms remain visible while new content genuinely animates.
- Every update still repairs/parses the whole document. Index-stable slots are not
  per-block parse memoization or constant-time rendering; reveal history grows
  with stream content. No comparative performance benchmark is claimed.
- SSR code starts as plain text (highlighting completes in browser); SSR Mermaid
  starts as source. Math/CJK parsing is synchronous and server-compatible.

## Validation

Validated: `bun run test:run` (**132 unit tests, 9 files**), `bun run typecheck`,
`bun run build`, and `bun run test:browser` (**5 Chromium tests**: native/published
four-plugin rendering and updates, rapid reveal/backlog cleanup, reduced motion,
long-guide rewrite visibility). Browser tests live separately from Vitest.

Node SSR smoke validation exercises native four-plugin output; it is not a full
hydration audit. The package root has Solid JSX, browser development/production,
Node server and declaration exports under `dist/index/`; feature JS/declarations
are under `dist/{code,math,cjk,mermaid}/`. Styles export separately as `./styles.css`.
