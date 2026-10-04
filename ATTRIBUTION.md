# Attribution

solid-streamdown is a SolidJS port of streaming markdown rendering
for AI chat interfaces. It draws from two reference implementations:

## Vercel Streamdown (Original)

- **Project**: [Streamdown](https://github.com/vercel/streamdown)
- **Author**: Hayden Bleasel / Vercel, Inc.
- **License**: Apache-2.0
- **Copyright**: Copyright 2023 Vercel, Inc.
- **Pinned ref**: `2.7.0`, commit `08da224`
- **References**: renderer contracts, block parsing/direction, processing helpers,
  native controls/composables, animation/streaming behavior and feature plugins

The original React-based streaming markdown renderer. solid-streamdown
follows the same unified/remark/rehype pipeline shape, adapted for
SolidJS's reactive runtime.

## svelte-streamdown (Svelte Port)

- **Project**: [svelte-streamdown](https://github.com/beynar/svelte-streamdown)
- **Author**: beynar
- **License**: MIT

Adaptation pattern reference for the legacy incomplete-markdown
pre-processor (`src/utils/parse-incomplete-markdown.ts`). The current
block-splitting utility (`src/utils/parse-blocks.ts`) is ported from React
Streamdown 2.7.0 and retains Apache-2.0 provenance, not Svelte/MIT provenance.

## Translation resource

- [react-to-solid](https://github.com/Blankeos/bagon-hooks/tree/main/.agents/skills/react-to-solid) — React → Solid translation patterns consulted during the port.

## Adapted implementations and contracts

`src/plugins/{code,math,cjk,mermaid}.ts`, `src/plugin-types.ts`, and the
newly adapted renderer helpers, public contracts and native UI/composable ports
are based on Vercel Streamdown 2.7.0, commit `08da224`. This includes block
splitting/direction, incomplete-fence helpers, HTML/tag preprocessing,
remark/rehype helpers, code/table/link/image/Mermaid controls, table and language
utilities, contexts, default components, translations/icons and class-prefix
behavior. File headers identify adapted sources and refer to the retained license.
These adaptations remain covered by Apache-2.0, not relicensed solely as MIT.
Copyright 2023 Vercel, Inc. The pinned upstream LICENSE names Vercel, Inc. as
copyright holder; Hayden Bleasel is credited above as the original author.
`LICENSE-STREAMDOWN` preserves that upstream notice and includes the full
Apache-2.0 license text. The adapted implementation headers identify their upstream
origin and refer to this attribution; this document also covers the adapted
structural contracts and native UI/helper ports. Both attribution and the Apache license are included in the
package's published file list.

Changes include native Solid component contracts, reactive props/accessors,
owner-scoped async work and cleanup, portal/lifecycle adaptations, packaging, a
native KaTeX CSS-path helper and absolute reveal schedules for Solid rendering.
Native framework translation does not independently relicense adapted upstream
material as MIT; the renderer is not described as wholly independent of the
upstream contracts, helpers and UI implementations. Original independently
written Solid code remains under MIT.

## License

The original Solid implementation is MIT; the adapted upstream files are
Apache-2.0 as noted above.
