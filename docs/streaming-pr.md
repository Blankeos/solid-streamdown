## Summary

Ports the React Streamdown 2.7.0 interface and features to native Solid, while preserving `StreamMarkdown` and `createMarkdownStream`.

- Native code/math/CJK/Mermaid plugins and composable block components.
- Copy/download controls, table fullscreen, diagram pan/zoom, link confirmation and portals.
- HTML sanitation/hardening, custom tag policies, cached blocks, RTL detection and resilient streaming reveal.
- Native whitespace flow during reveal, with shared glyph/space timing and browser layout/underline-paint regressions.
- Translations/icons, SSR/hydration support, and content-only Gittydocs documentation.

The goal is a 1:1 Solid replacement; [the compatibility checklist](https://github.com/Blankeos/solid-streamdown/blob/feat/streaming-content-animation/docs/streamdown-parity.md) records tested contracts and Solid-native adaptations.

## Usage: before and after

### Before — existing Solid streaming API

```tsx
import { StreamMarkdown, createMarkdownStream } from "solid-streamdown";
import "solid-streamdown/styles.css";

const stream = createMarkdownStream();
// In your transport: stream.write(chunk); on completion: stream.end();
// Before starting the next response: stream.reset();

export function MarkdownResponse() {
  return <StreamMarkdown stream={stream} />;
}
```

### After — native Streamdown 2.7.0-style API and plugins

The same stream can feed the new component, so the transport does not need to change:

```tsx
import { Streamdown, createMarkdownStream } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { math } from "solid-streamdown/math";
import { mermaid } from "solid-streamdown/mermaid";
import { cjk } from "solid-streamdown/cjk";
import "solid-streamdown/styles.css";
import "katex/dist/katex.min.css";

const stream = createMarkdownStream();
// In your transport: stream.write(chunk); on completion: stream.end();
// Before starting the next response: stream.reset();

export function MarkdownResponse() {
  return (
    <Streamdown
      plugins={{ code, math, mermaid, cjk }}
      animated
      caret="block"
      isAnimating={stream.isStreaming()}
    >
      {stream.content()}
    </Streamdown>
  );
}
```

`Streamdown` accepts reactive Markdown through `children` and an explicit active-stream flag through `isAnimating`. Native same-package plugins enable code highlighting, math, Mermaid and CJK support; `animated` opts into reveal animation, and `caret="block"` opts into the stream indicator. Applications can also pass their own Markdown/status signals directly instead of using `createMarkdownStream`.

**No migration is required:** `StreamMarkdown` and `createMarkdownStream` remain supported. The new direct API has different defaults: no caret unless requested, and incomplete-Markdown repair stays enabled in streaming mode even after the stream settles. The legacy API preserves its original defaults. The PR keeps the upstream `solid-streamdown` package name; the independently published scoped fork lives separately on the fork's `main` branch.

## Validation

196 unit tests, 31 Chromium tests, a separate hydration test, typecheck, built-package consumer types, build, Node SSR, isolated packed-package installation and docs build pass.
