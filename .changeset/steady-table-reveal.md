---
"@blankeos/solid-streamdown": patch
---

Fix settled characters (notably in tables) flashing back to partial opacity during streamed rewrites: whitespace-only text between root blocks is no longer rendered, so Solid's top-level child reconciliation no longer removes and re-inserts unchanged blocks (which restarted their CSS animations).
