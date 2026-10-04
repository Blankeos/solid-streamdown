# Solid Streamdown

A native SolidJS counterpart to Streamdown, built for AI-powered streaming Markdown.

## Overview

AI responses arrive a few tokens at a time, often before a link, code fence, or
formatting marker is complete. Solid Streamdown keeps that Markdown readable as
it grows, then renders the finished response in the same component.

Maintained at [Blankeos/solid-streamdown](https://github.com/Blankeos/solid-streamdown)
and forked from [vherbruck/solid-streamdown](https://github.com/vherbruck/solid-streamdown),
this library targets a 1:1 native Solid port of Vercel's
[Streamdown 2.7.0](https://github.com/vercel/streamdown). It uses Solid components
and reactivity throughout, without a React runtime wrapper.

## Features

- 🔄 **Streaming Markdown** — Render growing responses with reactive Solid props.
- 🧩 **Incomplete syntax repair** — `remend` handles unfinished formatting while text arrives.
- 📊 **GitHub Flavored Markdown** — Tables, task lists, and strikethrough.
- 🔢 **Math** — Display inline and block equations with KaTeX.
- 📈 **Mermaid diagrams** — Turn fenced diagram definitions into interactive diagrams.
- 🎨 **Highlighted code** — Shiki syntax colors with copy and download controls.
- 🛡️ **Content safety** — Default HTML sanitation, `rehype-harden`, and link confirmation.
- ⚡ **Incremental rendering** — Memoized blocks keep updates focused as content changes.
- ✨ **Solid-native customization** — Component overrides, reveal animations, carets, and reactive controls.

## Installation

Build and link the fork into your Solid application:

```bash
# In the fork checkout:
git clone --branch feat/streaming-content-animation https://github.com/Blankeos/solid-streamdown.git
cd solid-streamdown
bun install
bun run build
bun link

# Then, from your Solid application's directory:
bun link solid-streamdown
```

> This fork still uses the manifest version `solid-streamdown@1.0.1`; installing
> that name from npm does not select this checkout. For reproducible integration,
> pin a reviewed fork commit and distribute its built package through your package
> workflow—Git installs are not assumed to build `dist`. Your application must
> provide the `solid-js` peer dependency (`^1.8.0`).

Import the shipped stylesheet once in your application. Include KaTeX's
stylesheet if you enable the math provider:

```tsx
import "solid-streamdown/styles.css";
import "katex/dist/katex.min.css";
```

The package CSS supplies native layout, controls, and animation styles; Tailwind
is not required to render Markdown. If you use **Tailwind CSS v4**, register the
built package as a source in your global CSS to generate its utility classes too:

```css
@import "tailwindcss";
@source "../node_modules/solid-streamdown/dist";
```

Resolve the source path relative to that CSS file. Scanning the `dist` directory
includes the nested Solid builds and native provider subpaths; no separate
`@streamdown/*` packages or source entries are needed.

### Monorepo setup

When dependencies are hoisted, point to the workspace's `node_modules` rather
than assuming one exists beside the application:

```text
monorepo/
├── node_modules/solid-streamdown/
└── apps/
    └── web/
        └── src/
            └── globals.css
```

```css
/* From apps/web/src/globals.css to the workspace root. */
@source "../../../node_modules/solid-streamdown/dist";
```

Adjust the path for your workspace layout and the location of the linked package.

### CSS Custom Properties (Design Tokens)

Native menus, overlays, and controls use `--sd-*` variables with built-in fallback
values. Override them in your global CSS to match your application's palette:

```css
:root {
  --sd-background: #ffffff;
  --sd-foreground: #171717;
  --sd-border: #e5e5e5;
  --sd-muted: #737373;
  --sd-hover: #f5f5f5;
}

.dark {
  --sd-background: #171717;
  --sd-foreground: #fafafa;
  --sd-border: #404040;
  --sd-muted: #a3a3a3;
  --sd-hover: #262626;
}
```

If you already have shadcn-style theme variables, you can map them instead—for
example, `--sd-background: var(--background)` and
`--sd-foreground: var(--foreground)`. Tailwind utilities such as `bg-muted` use
your application's own theme; the native `--sd-*` variables do not define those
utilities. See [styling](docs/styling.mdx) for custom classes and animation styles.

## Usage

Pass the current Markdown text and stream status from your application's
transport. This Solid component reads both props reactively:

```tsx
import { Streamdown } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { math } from "solid-streamdown/math";
import { cjk } from "solid-streamdown/cjk";
import { mermaid } from "solid-streamdown/mermaid";
import "solid-streamdown/styles.css";
import "katex/dist/katex.min.css";

export function MarkdownResponse(props: {
  text: string;
  isStreaming: boolean;
}) {
  return (
    <Streamdown
      animated
      plugins={{ code, math, cjk, mermaid }}
      isAnimating={props.isStreaming}
    >
      {props.text}
    </Streamdown>
  );
}
```

Append incoming text to a signal and pass its current value as `text`; pass
`false` for `isStreaming` when the response finishes. `animated` enables reveal
animations, while `isAnimating` reports whether the stream is active. There is
no required chat SDK or transport.

Providers are opt-in and exported from the same package as native Solid
subpaths. Their underlying engines remain package runtime dependencies. Use
`mode="static"` for settled Markdown without streaming repair or reveal behavior.
See [configuration](docs/configuration.mdx), [native plugins](docs/plugins/index.mdx),
and [legacy compatibility](docs/legacy.mdx) for the full API.

## `fallbackComponent` — fallback for missing map entries

Use `fallbackComponent` to render tags without a built-in renderer or an explicit
`components` override. This includes custom elements admitted through
`allowedTags`. A Solid `Dynamic` component can pass through the original tag,
attributes, and children without forwarding the Markdown AST node to the DOM:

```tsx
import { splitProps, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Streamdown, type ExtraProps } from "solid-streamdown";

const Fallback: Component<Record<string, unknown> & ExtraProps> = (props) => {
  const [local, rest] = splitProps(props, ["node", "children"]);

  return (
    <Dynamic component={local.node?.tagName ?? "span"} {...rest}>
      {local.children as JSX.Element}
    </Dynamic>
  );
};

export function MentionResponse(props: { text: string }) {
  return (
    <Streamdown
      allowedTags={{ mention: ["user_id"] }}
      fallbackComponent={Fallback}
    >
      {props.text}
    </Streamdown>
  );
}
```

For example, `text` can contain `<mention user_id="42">Ada</mention>`. Built-in
renderers and explicit overrides still take precedence: this is not an unstyled
mode. To replace an existing renderer such as `p`, `a`, or `code`, supply it in
`components`. See [custom renderers](docs/custom-renderers.mdx).

## Documentation

Start with [getting started](docs/getting-started.mdx), then explore
[configuration](docs/configuration.mdx), [animation](docs/animation.mdx),
[interactivity](docs/interactivity.mdx), and [security](docs/security.mdx).
Treat model output as untrusted; custom plugins, renderers, and security callbacks
are trusted extensions, not substitutes for the default safety pipeline.

The documentation uses [Gittydocs](https://gittydocs.carlo.tl). Preview it locally
with `bun run docs:dev`, or build it with `bun run docs:build`.

For contribution and verification instructions, see
[maintenance](docs/maintaining.mdx) and the
[Streamdown parity checklist](docs/streamdown-parity.md), which records tested
behavior and the scope of the 2.7.0 port.

## License

The original Solid implementation is MIT-licensed. Adapted Vercel code retains
Apache-2.0 notices, Copyright 2023 Vercel, Inc. Legacy utilities also credit
MIT-licensed [svelte-streamdown](https://github.com/beynar/svelte-streamdown).
See [LICENSE](LICENSE), [LICENSE-STREAMDOWN](LICENSE-STREAMDOWN), and
[ATTRIBUTION.md](ATTRIBUTION.md).
