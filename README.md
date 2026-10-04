# solid-streamdown

A native SolidJS streaming Markdown renderer for AI chat interfaces, adapted from
[Vercel Streamdown](https://github.com/vercel/streamdown). No React wrapper or React
runtime is required. The `Streamdown` interface follows a **supported subset** of
React Streamdown 2.7.0; it is not full API, UI, security, or performance parity.
See the [compatibility matrix](docs/streamdown-parity.md).

## Install

```bash
npm install solid-streamdown solid-js
# or
bun add solid-streamdown solid-js
```

`solid-js` is a peer dependency. Shiki, KaTeX, Mermaid, CJK transforms and the
Markdown pipeline are runtime dependencies; the feature modules have separate
entry points, but these are not optional npm dependencies.

## Direct Streamdown interface

```tsx
import { Streamdown } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { math } from "solid-streamdown/math";
import { cjk } from "solid-streamdown/cjk";
import { mermaid } from "solid-streamdown/mermaid";
import "solid-streamdown/styles.css";
import "katex/dist/katex.min.css";

<Streamdown plugins={{ code, math, cjk, mermaid }} isAnimating={streaming()}>
  {markdown()}
</Streamdown>;
```

`children` is a reactive Markdown string, not arbitrary JSX. Plugins are opt-in;
omit `plugins` for basic GFM. The four native subpaths export default objects and
`createCodePlugin`, `createMathPlugin`, `createCjkPlugin`, and
`createMermaidPlugin` factories. The code factory accepts a light/dark `themes`
pair; math accepts `singleDollarTextMath` (default `false`) and `errorColor`;
Mermaid accepts `config`. Import KaTeX CSS explicitly; `getStyles` is not invoked
by the renderer.

Published `@streamdown/code@2.0.0` and math/CJK/Mermaid `1.0.3` plugin objects also
satisfy the structural contracts and are tested as alternative providers. Those
packages declare React peers; use the native subpaths to avoid those peers.
Custom language renderers must be **Solid components**, not React components.

### Streamdown props

| Prop                                  | Default       | Behavior                                                                     |
| ------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| `children`                            | `""`          | Reactive Markdown string                                                     |
| `mode`                                | `"streaming"` | `"static"` disables repair, reveal, caret and animation callbacks            |
| `parseIncompleteMarkdown`             | `true`        | Whole-document `remend` repair, including the final string in streaming mode |
| `isAnimating`                         | `false`       | Explicit active-stream state                                                 |
| `animated`                            | `false`       | `true` or `AnimateOptions` for word/character reveal                         |
| `caret`                               | absent        | Opt-in `"block"` or `"circle"` while animating                               |
| `class` / `className`                 | absent        | Wrapper class; `class` wins                                                  |
| `plugins`                             | absent        | `{ code, math, cjk, mermaid, renderers }`                                    |
| `shikiTheme`                          | plugin themes | Light/dark theme pair                                                        |
| `lineNumbers`                         | `true`        | Line numbers for highlighted code                                            |
| `mermaid`                             | absent        | `{ config }` passed to the diagram provider                                  |
| `dir`                                 | absent        | Native `"ltr"`, `"rtl"`, or `"auto"`; feature code/diagrams remain ltr       |
| `components`                          | absent        | Solid-native element overrides                                               |
| `remarkPlugins` / `rehypePlugins`     | absent        | Extra synchronous unified plugins                                            |
| `remarkRehypeOptions`                 | absent        | mdast-to-hast options                                                        |
| `urlTransform`                        | safe default  | Link/image policy `(url, key, tagName)`; null/undefined drops the attribute  |
| `onAnimationStart` / `onAnimationEnd` | absent        | Active-state transitions, not CSS completion events                          |

### Animated reveal

```tsx
<Streamdown isAnimating={streaming()} animated>
  {markdown()}
</Streamdown>

<Streamdown
  isAnimating={streaming()}
  animated={{ sep: "char", animation: "reveal", duration: 200, stagger: 24 }}
>
  {markdown()}
</Streamdown>
```

`true` uses `fadeIn`, 150 ms, `ease`, word splitting, and 40 ms stagger. Built-in
keyframes are `fadeIn`, `blurIn`, and `slideUp`; custom names resolve to
`sd-<name>` and require app CSS. `maxBacklogMs` defaults to 320 ms and bounds
queued start times. Absolute schedules resume reveals after DOM reinsertion
rather than restarting the delay. Source-position identity is best-effort, not
a guarantee across every Markdown rewrite or positionless plugin tree. The
stylesheet honors reduced motion.

### Custom rendering

```tsx
<Streamdown
  components={{
    a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  }}
  plugins={{
    renderers: [{ language: "widget", component: WidgetCode }],
  }}
>
  {markdown()}
</Streamdown>
```

Element overrides receive Solid DOM props (`class`, serialized `style`) and a
HAST `node`; native hosts never receive `node`. Custom fenced-language components
receive `code`, `language`, `meta`, and `isIncomplete`. A `pre` override bypasses
the feature-block renderer.

## Legacy StreamMarkdown interface

`StreamMarkdown` and `createMarkdownStream` remain supported and share the same
private renderer with `Streamdown`.

```tsx
import { StreamMarkdown, createMarkdownStream } from "solid-streamdown";
import "solid-streamdown/styles.css";

const stream = createMarkdownStream();
onSSEChunk((chunk) => stream.write(chunk));
onSSEEnd(() => stream.end());

<StreamMarkdown stream={stream} animated />;

// Static content:
<StreamMarkdown content="# Hello **world**" mode="static" />;
```

`StreamMarkdown` accepts `content` or `stream` (stream takes precedence), plus
the shared repair/animation/component/unified-plugin props above. It does not
expose the direct interface's feature-plugin props. Its legacy defaults differ:
`isAnimating` follows `stream.isStreaming()`, `showCaret` defaults to `true`, and
omitted `parseIncompleteMarkdown` repairs only while active. Pass explicit
`parseIncompleteMarkdown={true}` to keep a repaired final in streaming mode.
`isAnimating` can override the stream's state. Static mode always disables repair,
reveal, caret, and callbacks, even when explicitly enabled.

`createMarkdownStream({ initialContent? })` exposes `write(chunk)`, `end()`,
`reset()`, and reactive `content()` / `isStreaming()` accessors. `reset()` allows
reuse for a new response.

Other root exports:

- `parseIncompleteMarkdown` / `IncompleteMarkdownParser`: legacy line-based
  fixer; the components instead use whole-document `remend`.
- `parseMarkdownIntoBlocks`: utility for consumers, not the renderer's tick path.
- `animate` / `createAnimatePlugin(options?)`: standalone synchronous rehype
  reveal plugin; the component supplies its own shared bounded timeline.
- Component, stream, animation, and structural feature-plugin types.

## Trust, SSR and performance

- Raw HTML is disabled by default. URL filtering applies to `a[href]` and
  `img[src/srcSet/srcset]`, not every URL-bearing attribute or element. The default
  allows HTTP(S), mailto, tel, streaming placeholders and relative URLs, rejecting
  other schemes (including control-character smuggling). **This is not a full
  HTML sanitizer.** Custom unified plugins, URL policies, component overrides,
  token attributes/styles, and Mermaid configuration are trusted extensions.
- Mermaid runs only in the browser and sanitizes returned SVG with DOMPurify,
  preserving `foreignObject` labels. Stale highlight/diagram completions are
  ignored on updates/unmount; already-started provider work is not abortable.
- The package has a Node/server root export. SSR renders plain code and Mermaid
  source; highlighting/diagrams activate in the browser. Math/CJK are synchronous.
  SSR smoke validation is not a comprehensive hydration or security audit.
- Each update repairs and parses the **whole document**, then uses index-stable
  recursive slots. This favors Markdown correctness, not constant-time updates or
  guaranteed node identity. Source-based reveal history survives tested structural
  rewrites, but decoded text, missing positions and changed ancestors can change
  identity. History grows with revealed content during a stream. No comparative
  performance benchmark or universal no-flicker claim is made.

## Package exports and validation

The root supplies types (`dist/index/index.d.ts`), Solid source JSX
(`dist/index/index.jsx`), browser development/production builds and a Node SSR
build (`dist/index/server.js`). Feature modules are `./code`, `./math`, `./cjk`,
and `./mermaid` (`dist/<name>/index.js` plus declarations); styles are `./styles.css`.

```bash
bun run test:run       # 132 unit tests, 9 files
bun run test:browser   # 5 Chromium tests, separate from Vitest
bun run typecheck
bun run build
```

See [PR scope and validation](docs/streaming-pr.md) for the review summary.

## Attribution and license

Original Solid implementation: MIT. Adapted upstream plugin implementations and
contracts: Apache-2.0, Copyright 2023 Vercel, Inc.; see
[ATTRIBUTION.md](ATTRIBUTION.md) and [LICENSE-STREAMDOWN](LICENSE-STREAMDOWN).
The legacy parser/block utilities also reference
[svelte-streamdown](https://github.com/beynar/svelte-streamdown) (MIT).
