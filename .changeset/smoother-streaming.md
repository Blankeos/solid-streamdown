---
"@blankeos/solid-streamdown": patch
---

Smoother long animated streams: appending to a long paragraph no longer re-subscribes or re-compares every already revealed character. Element children render through a flat per-slot node list, so the host's insert tracks one list instead of one accessor per child, and fully revealed spans are reused between passes and shared by reference. In Chrome, a 6.4k-character paragraph streamed in 20-character chunks with per-character fade-in finishes in about 6 s instead of 11-12 s, with no frames over 50 ms (previously 37-83).
