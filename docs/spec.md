# Native Solid Streamdown implementation scope

The maintained fork implements the functional surface of React Streamdown **2.7.0** (reference `08da224`) with native Solid components and reactivity. It is not a React wrapper. The independently maintained package is `@blankeos/solid-streamdown`; the goal is to merge the implementation into upstream `solid-streamdown`.

Implemented areas include reactive Markdown children and active-stream state, streaming/static modes, remend repair, block splitting/memoized rendering and direction, default raw HTML sanitation/hardening, custom tags/literal content/fallback components, element and URL policies, default-enabled link confirmation, portal overlays, native providers and custom fenced renderers, code/table/image/Mermaid controls, composable exports, translations/icons and opt-in reveal/carets. Legacy stream APIs retain their separate defaults.

See [configuration](configuration.mdx), [components](components.mdx), [security](security.mdx), and [the evidence checklist](streamdown-parity.md). Source and mapped fixtures document implementation; final command results are recorded separately. No exhaustive security audit, universal hydration guarantee, constant-time parsing or comparative performance equivalence is claimed.

Documentation remains content-only Gittydocs 0.0.7. Installation uses the npm registry package. No custom documentation UI or deployment is part of this scope.
