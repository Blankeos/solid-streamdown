# Upstream PR

## Title

feat: add native Streamdown API, four feature plugins and resilient streaming reveal

## Body

### Summary

Bring the Solid renderer closer to React Streamdown 2.7.0's core interface while
preserving the legacy `StreamMarkdown` / `createMarkdownStream` API. This is a
native Solid implementation, not a React wrapper and not full upstream parity.

- Add reactive string `children` via `Streamdown`, React-compatible core defaults,
  class/className, caret styles, native direction, and Solid component overrides.
  Both public components share one private renderer and retain their own defaults.
- Publish native `solid-streamdown/code`, `/math`, `/cjk`, and `/mermaid` plugin
  entry points: dual-theme Shiki, KaTeX, CJK transforms, sanitized Mermaid SVG, and
  custom Solid fenced-language renderers. Also validate published `@streamdown/*`
  structural plugin objects. Native entry points require no React peers.
- Use whole-document `remend` repair and reactive HAST rendering, with synchronous
  remark/rehype hooks and link/image URL policy. Invalidate stale async code and
  diagram completions; SSR starts with code/diagram source rather than browser work.
- Add opt-in word/character reveal, bounded cascading start times, reduced-motion
  support, and absolute schedules that survive tested DOM/Markdown rewrites.
- Document package exports, compatibility limits, dependencies, and retained
  Apache-2.0 attribution for adapted upstream plugins/contracts.

### Long-message regression

The Chromium fixture streams a roughly **5.4 KB** Markdown guide in 3–20 character
chunks at 15 ms. It covers loose/nested lists, late references, table conversion,
code fences, rules and footnotes. It requires genuine intermediate opacity on new
content and visibility of observed characters older than 850 ms during streaming.

Previously, root reconciliation could reinsert a surviving paragraph and restart
its CSS animation with the original positive delay. Reveal history now records
absolute birth/start/end times by HAST source origin (rendered-offset fallback for
positionless trees). Re-rendered units use remaining/negative delay, and completed
units use zero duration. This repairs the regression without timers, observers,
or disabling animation for long responses.

### Scope and limitations

See [the compatibility matrix](streamdown-parity.md). No full controls/UI parity:
copy/download/fullscreen/pan-zoom, table controls, link confirmation, translations,
portals, raw-HTML processing/security configuration and custom block splitting are
not implemented. Native `dir="auto"` is not React's semantic-block direction logic.

URL filtering is not a general sanitizer; plugins/components/token attributes and
styles are trusted code. Mermaid SVG has its own DOMPurify boundary, and upstream
render work already started cannot be cancelled. No claim of identical React
security. Math CSS must be imported explicitly.

Whole-document parsing remains on every update; no constant-time or comparative
performance claim. Source identity is best-effort: transformed/decoded text,
positionless plugin output and structural ancestor changes can still change or
remount units. Reveal history grows with stream content. This regression coverage
does not prove continuity for all Markdown rewrites.

This is broader than an animation-only patch: package exports and runtime
Shiki/KaTeX/Mermaid/CJK dependencies are part of the review surface. Legacy
`StreamMarkdown` keeps repair-while-active and caret defaults; the new direct API
repairs by default in streaming mode and requires explicit animation/caret opt-in.

### Validation

- `bun run test:run`: **132 unit tests in 9 files**.
- `bun run test:browser`: **5 Chromium tests**, including native/published
  four-plugin rendering and updates, rapid reveal/backlog cleanup, reduced motion,
  and the long-guide structural-rewrite regression.
- `bun run typecheck` and `bun run build`.
- Node SSR smoke check against the server root export; source fallback for async
  features and synchronous math/CJK. This is not a full hydration audit.
- Root browser/dev/Solid/server outputs under `dist/index/`; four plugin outputs
  under `dist/{code,math,cjk,mermaid}/`, each with declarations.

### References and licensing

React Streamdown `2.7.0`, commit `08da224`; legacy parser/block adaptation references
svelte-streamdown. The adapted native plugin implementations and structural
contracts retain Apache-2.0 attribution to Vercel, Inc. Original Solid code remains
MIT. See `ATTRIBUTION.md` and the included `LICENSE-STREAMDOWN`.
