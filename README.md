# Solid Streamdown

Native SolidJS streaming Markdown, maintained in
[Blankeos/solid-streamdown](https://github.com/Blankeos/solid-streamdown), forked
from [vherbruck/solid-streamdown](https://github.com/vherbruck/solid-streamdown).
The exact port target is **React Streamdown 2.7.0** from
[vercel/streamdown](https://github.com/vercel/streamdown).

The goal is a 1:1 native Solid drop-in for that API, not a React wrapper.
Component-valued props use Solid `Component`/`JSX` types and Solid reactivity.
The full 2.7.0 functional surface is implemented, including block rendering,
security configuration, controls and public composables. Implementation and mapped
fixtures do **not** establish exhaustive performance or security parity. See
[the acceptance checklist](docs/streamdown-parity.md) for verified behavior and evidence boundaries.

## Use this fork

The manifest retains `solid-streamdown@1.0.1`. No new npm publication is claimed:
`bun add solid-streamdown` alone selects the registry release, not this fork.
Build and link the reviewed checkout:

```bash
git clone --branch feat/streaming-content-animation https://github.com/Blankeos/solid-streamdown.git
cd solid-streamdown
bun install
bun run build
bun link
# In your Solid application:
bun link solid-streamdown
```

For reproducible integration, pin a fork commit and distribute its built package
through your own package workflow. Git installation is not assumed to build
`dist` automatically. `solid-js` is a peer dependency.

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

`children` is reactive Markdown text. Feature providers are opt-in; same-package
native subpaths avoid upstream plugin packages' React peers. Shiki, KaTeX,
Mermaid and CJK transforms remain package runtime dependencies, not optional npm
dependencies. KaTeX CSS is imported explicitly.

Direct defaults: streaming mode, incomplete repair on, active streaming off,
reveal off and no caret. Static mode disables repair, reveal, caret and animation
callbacks. Legacy `StreamMarkdown` and `createMarkdownStream` retain their
original stream input and caret/repair defaults; see
[legacy compatibility](docs/legacy.mdx).

## Documentation

Content-only [Gittydocs](https://gittydocs.carlo.tl) documentation lives in
`docs/*.mdx` and `docs/gittydocs.jsonc`; no custom docs application or deployment
hostname is configured.

```bash
bunx gittydocs@0.0.6 dev ./docs
bunx gittydocs@0.0.6 build ./docs --out /tmp/solidstreamdown-docs-dist
```

See [configuration](docs/configuration.mdx), [security](docs/security.mdx),
[native plugins](docs/plugins/index.mdx), and [maintenance](docs/maintaining.mdx).
The topic coverage mirrors upstream documentation with original Solid examples.

## Validation and maintenance

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

Install Chromium for browser tests with `bunx playwright install chromium`.
Read `.agents/skills/solid-streamdown-maintain/SKILL.md` before updating upstream
contracts. [PR scope](docs/streaming-pr.md) and the parity checklist separate
verified behavior from broader equivalence claims. No universal benchmark or audit is
claimed. Server output uses the Node export; async highlighting and diagrams
activate in the browser.

## Trust and license

Treat model output as untrusted. Raw HTML is parsed, sanitized and hardened by
default. `linkSafety` is enabled by default: an optional sync/async `onLinkCheck`
can allow navigation, otherwise the built-in confirmation dialog opens. Custom
plugins, component overrides, URL policies and Mermaid configuration are trusted
extensions. A link confirmation modal is not a sanitizer. See [security](docs/security.mdx) for pipeline replacement and trust
boundaries.

Original Solid implementation: MIT. Adapted Vercel code/contracts retain
Apache-2.0 notices, Copyright 2023 Vercel, Inc. See [ATTRIBUTION.md](ATTRIBUTION.md),
[LICENSE](LICENSE), and [LICENSE-STREAMDOWN](LICENSE-STREAMDOWN). Legacy utilities
also reference MIT-licensed [svelte-streamdown](https://github.com/beynar/svelte-streamdown).
