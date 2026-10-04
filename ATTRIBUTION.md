# Attribution

solid-streamdown is a SolidJS port of streaming markdown rendering
for AI chat interfaces. It draws from two reference implementations:

## Vercel Streamdown (Original)

- **Project**: [Streamdown](https://github.com/vercel/streamdown)
- **Author**: Hayden Bleasel / Vercel, Inc.
- **License**: Apache-2.0
- **Copyright**: Copyright 2023 Vercel, Inc.
- **Pinned ref**: `2.7.0`, commit `08da224`
- **References**: animation/streaming behavior, feature-plugin implementations
  and structural interfaces

The original React-based streaming markdown renderer. solid-streamdown
follows the same unified/remark/rehype pipeline shape, adapted for
SolidJS's reactive runtime.

## svelte-streamdown (Svelte Port)

- **Project**: [svelte-streamdown](https://github.com/beynar/svelte-streamdown)
- **Author**: beynar
- **License**: MIT

Adaptation pattern reference for the legacy incomplete-markdown
pre-processor (`src/utils/parse-incomplete-markdown.ts`) and
block-splitting utility (`src/utils/parse-blocks.ts`).

## Translation resource

- [react-to-solid](https://github.com/Blankeos/bagon-hooks/tree/main/.agents/skills/react-to-solid) — React → Solid translation patterns consulted during the port.

## Adapted plugin implementations

`src/plugins/{code,math,cjk,mermaid}.ts` and the structural contracts in
`src/plugin-types.ts` are adapted from Vercel Streamdown commit `08da224`.
These adaptations remain covered by Apache-2.0, not relicensed solely as MIT.
Copyright 2023 Vercel, Inc. The pinned upstream LICENSE names Vercel, Inc. as
copyright holder; Hayden Bleasel is credited above as the original author.
`LICENSE-STREAMDOWN` preserves that upstream notice and includes the full
Apache-2.0 license text. The plugin implementation headers identify their upstream
origin and refer to this attribution; this document also covers the adapted
structural contracts. Both attribution and the Apache license are included in the
package's published file list.

Changes include native Solid component contracts and packaging, a native KaTeX
CSS-path helper, and adjustments to plugin implementation behavior. The Solid
renderer and shared core are independently implemented; the animation behavior
was reimplemented with absolute schedules for Solid's reactive rendering.

## License

The original Solid implementation is MIT; the adapted upstream files are
Apache-2.0 as noted above.
