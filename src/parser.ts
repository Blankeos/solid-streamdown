import type { JSX } from "solid-js";
import { unified } from "unified";
import type { PluggableList } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import type { Options as RemarkRehypeOptions } from "remark-rehype";
import remend from "remend";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { jsx, jsxs, Fragment } from "solid-js/h/jsx-runtime";
import type { Element, ElementContent, Root, RootContent } from "hast";
import type { ComponentOverrides } from "./types";
import { defaultSafeUrlTransform, sanitizeSrcset } from "./safe-url";
import type { UrlTransform } from "./safe-url";

export type { UrlTransform } from "./safe-url";

export interface ParseOptions {
  components?: ComponentOverrides;
  plugins?: import("./plugin-types").PluginConfig;
  /** Whether content is streaming (repairs incomplete markdown first) */
  isStreaming?: boolean;
  /** Extra remark plugins, applied after GFM */
  remarkPlugins?: PluggableList;
  /** Extra rehype plugins, applied after the mdast-to-hast step */
  rehypePlugins?: PluggableList;
  /** Overrides for the mdast-to-hast conversion */
  remarkRehypeOptions?: RemarkRehypeOptions;
  /** Custom URL policy; defaults to rejecting unsafe schemes */
  urlTransform?: UrlTransform;
}

const defaultProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false });

function createProcessor(options?: ParseOptions) {
  if (
    !options?.plugins &&
    !options?.remarkPlugins?.length &&
    !options?.rehypePlugins?.length &&
    !options?.remarkRehypeOptions
  ) {
    return defaultProcessor;
  }
  return unified()
    .use(remarkParse)
    .use(options?.plugins?.cjk?.remarkPluginsBefore ?? [])
    .use(remarkGfm)
    .use(options?.plugins?.cjk?.remarkPluginsAfter ?? [])
    .use(options?.plugins?.math ? [options.plugins.math.remarkPlugin] : [])
    .use(options?.remarkPlugins ?? [])
    .use(remarkRehype, {
      allowDangerousHtml: false,
      ...options?.remarkRehypeOptions,
    })
    .use(options?.plugins?.math ? [options.plugins.math.rehypePlugin] : [])
    .use(options?.rehypePlugins ?? []);
}

function sanitizeElementUrls(node: Element, transform: UrlTransform): void {
  const properties = node.properties;
  if (!properties) {
    return;
  }
  if (node.tagName === "a" && typeof properties.href === "string") {
    const next = transform(properties.href, "href", node.tagName);
    if (next == null) {
      delete properties.href;
    } else {
      properties.href = next;
    }
  }
  if (node.tagName === "img") {
    if (typeof properties.src === "string") {
      const next = transform(properties.src, "src", node.tagName);
      if (next == null) {
        delete properties.src;
      } else {
        properties.src = next;
      }
    }
    // HAST canonical property is `srcSet` (HTML attribute `srcset`).
    // Sanitize both the canonical name and the legacy lowercase alias so a
    // rehype plugin setting either form still goes through the URL policy.
    // The custom transform sees the actual property key in use.
    for (const key of ["srcSet", "srcset"] as const) {
      const value = properties[key];
      if (typeof value === "string") {
        const next = sanitizeSrcset(value, (url, _key, tagName) =>
          transform(url, key, tagName),
        );
        if (next == null) {
          delete properties[key];
        } else {
          properties[key] = next;
        }
      }
    }
  }
}

function sanitizeTreeUrls(
  nodes: RootContent[] | ElementContent[],
  transform: UrlTransform,
): void {
  for (const node of nodes) {
    if (node.type !== "element") {
      continue;
    }
    sanitizeElementUrls(node, transform);
    sanitizeTreeUrls(node.children, transform);
  }
}

/**
 * Parses markdown into a hast tree with link/image URL policy applied.
 *
 * This is the AST seam for renderers that need stable recursive rendering:
 * the tree is repaired when streaming (via remend) and `href`/`src`/`srcSet`
 * URLs are filtered through the URL policy, so each node can be rendered
 * independently. This is only a link/image URL policy — not a full HTML
 * sanitizer. Pass a custom `urlTransform` to intentionally override the
 * default safe-URL policy (e.g. to proxy, rewrite, or drop URLs).
 * Whole-document streaming repair happens here via remend — callers pass the
 * complete content, not pre-split blocks.
 */
export function parseMarkdownTree(
  content: string,
  options?: ParseOptions,
): Root {
  const prepared = options?.isStreaming ? remend(content) : content;
  const processor = createProcessor(options);
  const tree = processor.runSync(processor.parse(prepared)) as unknown as Root;
  sanitizeTreeUrls(
    tree.children,
    options?.urlTransform ?? defaultSafeUrlTransform,
  );
  return tree;
}

export function parseMarkdown(
  content: string,
  options?: ParseOptions,
): JSX.Element {
  if (!content) return null;

  const tree = parseMarkdownTree(content, options);

  return toJsxRuntime(tree as Parameters<typeof toJsxRuntime>[0], {
    jsx: jsx as any,
    jsxs: jsxs as any,
    Fragment,
    components: options?.components as any,
  }) as JSX.Element;
}
