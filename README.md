# Solid Streamdown

A SolidJS port of Streamdown, designed for AI-powered streaming.

## Overview

Formatting Markdown is easy, but when you tokenize and stream it, new challenges arise. Solid Streamdown is built specifically to handle the unique requirements of streaming Markdown content from AI models, providing seamless formatting even with incomplete or unterminated Markdown blocks.

This fork aims to be a 1:1 native Solid port of Vercel's [Streamdown 2.7.0](https://github.com/vercel/streamdown), based on the original [Solid Streamdown](https://github.com/vherbruck/solid-streamdown).

## Features

- 🚀 **1:1 Solid port** of Streamdown 2.7.0 is the goal
- 🔄 **Streaming-optimized** - Handles incomplete Markdown gracefully
- 🎨 **Unterminated block parsing** - Build with `remend` for better streaming quality
- 📊 **GitHub Flavored Markdown** - Tables, task lists, and strikethrough support
- 🔢 **Math rendering** - LaTeX equations via KaTeX
- 📈 **Mermaid diagrams** - Render Mermaid diagrams automatically
- 🎯 **Code syntax highlighting** - Beautiful code blocks with Shiki
- 🛡️ **Security-first** - Built with `rehype-harden` for safe rendering
- ⚡ **Performance optimized** - Memoized rendering for efficient updates

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

> This fork is not published on npm; the registry package is the original Solid repository's release, not this fork. Your application needs the `solid-js` peer dependency (`^1.8.0`). See [getting started](docs/getting-started.mdx) for more installation options.

Import the stylesheet in your application. If you use the math plugin, also import the KaTeX stylesheet:

```tsx
import "katex/dist/katex.min.css";
import "solid-streamdown/styles.css";
```

If you use Tailwind, update your Tailwind `globals.css` to include the following so that Tailwind can detect the utility classes used by Solid Streamdown.

```css
@source "../node_modules/solid-streamdown/dist";
```

The path must be relative from your CSS file to the `node_modules` folder containing `solid-streamdown`. The `dist` directory includes the native plugins, so no separate plugin `@source` entries are needed. Tailwind is optional.

### Monorepo setup

In a monorepo (npm workspaces, Turbo, pnpm, etc.), dependencies are typically hoisted to the root `node_modules`. You need to adjust the relative path to point there:

```text
monorepo/
├── node_modules/solid-streamdown/  ← hoisted here
├── apps/
│   └── web/
│       └── src/
│           └── globals.css   ← your CSS file
```

```css
/* apps/web/src/globals.css → 3 levels up to reach root node_modules */
@source "../../../node_modules/solid-streamdown/dist";
```

Adjust the number of `../` segments based on where your CSS file lives relative to the root `node_modules`.

### CSS Custom Properties (Design Tokens)

Solid Streamdown components use CSS custom properties for colors, with built-in fallback values. Add the following to your global CSS to customize them:

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

See [styling](docs/styling.mdx) for more options.

## Usage

Here's how you can use Solid Streamdown in your Solid application with the AI SDK:

Install the community Solid adapter [ai-sdk-solid](https://github.com/rajaniraiyn/ai-sdk-solid):

```bash
bun add ai-sdk-solid
```

This example requires an AI SDK chat endpoint at `/api/chat`; call `sendMessage` from `useChat` to start a response.

```tsx
import { For, Index, Show } from "solid-js";
import { useChat } from "ai-sdk-solid";
import { Streamdown } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { mermaid } from "solid-streamdown/mermaid";
import { math } from "solid-streamdown/math";
import { cjk } from "solid-streamdown/cjk";
import "katex/dist/katex.min.css";
import "solid-streamdown/styles.css";

export default function Chat() {
  const { messages, status } = useChat();

  return (
    <div>
      <For each={messages}>
        {(message) => (
          <div>
            {message.role === "user" ? "User: " : "AI: "}
            <Index each={message.parts}>
              {(part) => {
                const textPart = () => {
                  const value = part();
                  return value.type === "text" ? value.text : undefined;
                };
                return (
                  <Show when={part().type === "text"}>
                    <Streamdown
                      animated
                      plugins={{ code, mermaid, math, cjk }}
                      isAnimating={status() === "streaming"}
                    >
                      {textPart()}
                    </Streamdown>
                  </Show>
                );
              }}
            </Index>
          </div>
        )}
      </For>
    </div>
  );
}
```

`messages` is a reactive array; `status` is an accessor. `Index` keeps each part's renderer mounted while its text updates.

For more info, see the [documentation](docs/configuration.mdx).

## `fallbackComponent` — fallback for missing map entries

Solid Streamdown ships built-in renderers for common markdown tags. For tags that are
**not** in that map — and not overridden via `components` — you can provide a
`fallbackComponent`. Useful for `allowedTags` custom elements and uncovered HTML
tags like `<span>`, `<em>`, `<div>`, or `<br>`.

This is **not** a full unstyled mode: built-in entries (and any explicit
`components` overrides) still take precedence. To restyle tags that already have
defaults (e.g. `h1`, `p`, `code`), pass them in `components`.

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

// Render missing map entries / allowedTags via a pass-through
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

Combine with explicit overrides when some tags need special treatment:

```tsx
// Using Fallback from the example above:
export function CustomResponse(props: { text: string }) {
  return (
    <Streamdown
      allowedTags={{ mention: ["user_id"] }}
      fallbackComponent={Fallback}
      components={{
        code: (props) => {
          const [local, rest] = splitProps(props, ["node", "children"]);
          return <code {...rest}>{local.children}</code>;
        },
        a: (props) => {
          const [local, rest] = splitProps(props, ["node", "children"]);
          return <a {...rest}>{local.children}</a>;
        },
      }}
    >
      {props.text}
    </Streamdown>
  );
}
```

## Documentation

The documentation uses [Gittydocs](https://gittydocs.carlo.tl). Preview it locally with `bun run docs:dev`, or build it with `bun run docs:build`.
See [maintenance](docs/maintaining.mdx) and the [Streamdown parity checklist](docs/streamdown-parity.md) for contribution and verification instructions.

## License

The original Solid implementation is MIT-licensed. Adapted Vercel code retains Apache-2.0 notices, Copyright 2023 Vercel, Inc. Legacy utilities also credit MIT-licensed [svelte-streamdown](https://github.com/beynar/svelte-streamdown).
See [LICENSE](LICENSE), [LICENSE-STREAMDOWN](LICENSE-STREAMDOWN), and [ATTRIBUTION.md](ATTRIBUTION.md).
