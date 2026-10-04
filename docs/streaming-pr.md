# Native Solid Streamdown port

## Summary

Brings the React Streamdown 2.7.0 interface and features to native Solid while
preserving `StreamMarkdown` and `createMarkdownStream`.

- Native code/math/CJK/Mermaid plugins and composable block components.
- Code, table, image and diagram controls, exports, fullscreen and pan/zoom.
- HTML sanitation/hardening, custom tag policies, link confirmation and portals.
- Cached block rendering, RTL detection, translations/icons and resilient reveal.
- Content-only Gittydocs documentation with a 1:1 compatibility goal.

## Validation

194 unit tests, 18 Chromium tests, a separate hydration test, typecheck,
built-package consumer types, build, Node SSR and documentation build pass.
See [the compatibility checklist](streamdown-parity.md) for evidence and native
Solid adaptations. No exhaustive security or performance equivalence claim.
