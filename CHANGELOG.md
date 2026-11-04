# @blankeos/solid-streamdown

## 1.1.1

### Patch Changes

- [#3](https://github.com/Blankeos/solid-streamdown/pull/3) [`7a95a8d`](https://github.com/Blankeos/solid-streamdown/commit/7a95a8d452305c793fc2a90fb9790a0eace1328c) Thanks [@Blankeos](https://github.com/Blankeos)! - Smoother long animated streams: appending to a long paragraph no longer re-subscribes or re-compares every already revealed character. Element children render through a flat per-slot node list, so the host's insert tracks one list instead of one accessor per child, and fully revealed spans are reused between passes and shared by reference. In Chrome, a 6.4k-character paragraph streamed in 20-character chunks with per-character fade-in finishes in about 6 s instead of 11-12 s, with no frames over 50 ms (previously 37-83).

- [#2](https://github.com/Blankeos/solid-streamdown/pull/2) [`179ce4f`](https://github.com/Blankeos/solid-streamdown/commit/179ce4f57e9cf816ff1794e2bac942e7b7fd3f83) Thanks [@Blankeos](https://github.com/Blankeos)! - Fix settled characters (notably in tables) flashing back to partial opacity during streamed rewrites: whitespace-only text between root blocks is no longer rendered, so Solid's top-level child reconciliation no longer removes and re-inserts unchanged blocks (which restarted their CSS animations).
