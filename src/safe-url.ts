/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Native passthrough URL contract adapted from Streamdown 2.7.0.
 * Legacy safe-URL helpers below are independently implemented.
 */
import type { StreamdownUrlTransform } from "./types";

/**
 * Native URL policy belongs to sanitization/hardening, not this callback.
 * Replacing default rehype plugins or supplying a transform is a trust boundary:
 * application code must enforce its own policy before untrusted HAST renders.
 */
export const defaultUrlTransform: StreamdownUrlTransform = (value) => value;

/**
 * Safe URL policy for rendered links and images.
 *
 * Markdown sources in chat interfaces are untrusted model output, so URLs
 * extracted from `[text](url)` and `![alt](url)` must never become live
 * `javascript:`, `data:`, or `vbscript:` references. This module implements
 * that check as small independent functions (no third-party sanitizer) so
 * the parser can apply it directly to the hast tree before JSX conversion.
 */

/**
 * Rewrites or rejects a URL found on an element.
 * Return null/undefined to drop the attribute.
 */
export type UrlTransform = (
  url: string,
  key: string,
  tagName: string,
) => string | null | undefined;

/**
 * URL schemes that are safe to render as-is. `streamdown` is the sentinel
 * scheme the streaming repair step emits for incomplete links/images
 * (`streamdown:incomplete-link`, `streamdown:incomplete-image`), so it must
 * survive sanitizing or streaming placeholders lose their marker.
 */
const ALLOWED_SCHEMES = new Set([
  "http",
  "https",
  "mailto",
  "tel",
  "streamdown",
]);

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * Whether a URL is safe to render in `href`/`src`.
 *
 * Rejects `javascript:`, `data:`, `vbscript:`, and any other scheme outside
 * the allowlist. Scheme detection runs on the URL with ASCII whitespace and
 * control characters stripped first, because browsers ignore those characters
 * (`java<tab>script:` still executes). URLs without a scheme — relative
 * paths, anchors, queries, protocol-relative URLs — are harmless and allowed.
 */
export function isSafeUrl(url: string): boolean {
  if (typeof url !== "string") {
    return false;
  }
  const compact = url.replace(/[\u0000-\u0020]+/g, "");
  if (!compact) {
    return false;
  }
  const match = SCHEME_PATTERN.exec(compact);
  if (!match) {
    return true;
  }
  return ALLOWED_SCHEMES.has(match[1].toLowerCase());
}

/**
 * Default URL transform: keeps safe URLs untouched, drops unsafe ones.
 * Pass as `urlTransform` or omit the option — the parser uses this by default.
 */
export function defaultSafeUrlTransform(url: string): string | undefined {
  return isSafeUrl(url) ? url : undefined;
}

/**
 * Filters an `img` srcset value, keeping only candidates with safe URLs.
 * Returns the filtered srcset, or undefined when nothing safe remains.
 */
export function sanitizeSrcset(
  srcset: string,
  transform: UrlTransform = defaultSafeUrlTransform,
): string | undefined {
  const kept: string[] = [];
  for (const candidate of srcset.split(",")) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    const url = trimmed.split(/\s+/, 1)[0];
    const next = transform(url, "srcset", "img");
    if (next) {
      kept.push(trimmed.replace(url, next));
    }
  }
  return kept.length > 0 ? kept.join(", ") : undefined;
}
