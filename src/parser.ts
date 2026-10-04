/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Native pipeline and HAST postprocessing adapted from Streamdown 2.7.0.
 * JSX conversion and legacy compatibility use Solid's runtime.
 */
import type { JSX } from "solid-js";
import { unified } from "unified";
import type { PluggableList } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import type { Options as RemarkRehypeOptions } from "remark-rehype";
import { urlAttributes } from "html-url-attributes";
import rehypeRaw from "rehype-raw";
import { prepareMarkdown } from "./preprocess";
import {
  defaultRemarkPluginsArray,
  defaultRehypePluginsArray,
  resolveRehypePlugins,
} from "./markdown-plugins";
import { remarkEscapeHtml } from "./remark/escape-html";
import { remarkDisableAutolinkProtocols } from "./remark/disable-autolink-protocols";
import { rehypeLiteralTagContent } from "./rehype/literal-tag-content";
export { defaultRehypePlugins, defaultRemarkPlugins } from "./markdown-plugins";
export { normalizeHtmlIndentation, prepareMarkdown } from "./preprocess";
export { defaultUrlTransform } from "./safe-url";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { jsx, jsxs, Fragment } from "solid-js/h/jsx-runtime";
import type { Element, Root } from "hast";
import { resolveComponentFallback } from "./component-fallback";
import type { ComponentOverrides } from "./types";
import {
  defaultSafeUrlTransform,
  defaultUrlTransform,
  sanitizeSrcset,
} from "./safe-url";
import type { UrlTransform } from "./safe-url";

export type { UrlTransform } from "./safe-url";
import type { PreprocessOptions } from "./preprocess";

export interface ParseOptions extends PreprocessOptions {
  /** Opt into Streamdown 2.7 raw → sanitize → harden defaults. Legacy callers remain raw-disabled. */
  streamdownDefaults?: boolean;
  /** Core sets this for blocks after preparing the whole document with prepareMarkdown. */
  skipPreprocessing?: boolean;
  skipHtml?: boolean;
  disableAutolinkProtocols?: string[];

  components?: ComponentOverrides;
  fallbackComponent?: import("./types").StreamdownProps["fallbackComponent"];
  nodeUrlTransform?: import("./types").StreamdownUrlTransform;
  allowedElements?: readonly string[];
  disallowedElements?: readonly string[];
  allowElement?: import("./types").StreamdownProps["allowElement"];
  unwrapDisallowed?: boolean;
  plugins?: import("./plugin-types").PluginConfig;
  /** Whether content is streaming (repairs incomplete markdown first) */
  isStreaming?: boolean;
  /** Native mode replaces defaults; legacy mode appends after GFM. */
  remarkPlugins?: PluggableList;
  /** Native mode replaces raw/sanitize/harden defaults; legacy mode appends plugins. */
  rehypePlugins?: PluggableList;
  /** Overrides for the mdast-to-hast conversion */
  remarkRehypeOptions?: Readonly<RemarkRehypeOptions>;
  /** Custom URL policy; defaults to rejecting unsafe schemes */
  urlTransform?: UrlTransform;
}

function createProcessor(options: ParseOptions = {}) {
  const native = options.streamdownDefaults;
  const rehypePlugins = native
    ? resolveRehypePlugins(options.rehypePlugins, options.allowedTags)
    : (options.rehypePlugins ?? []);
  const hasRaw = rehypePlugins.some(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === rehypeRaw,
  );
  const remarkPlugins = native
    ? (options.remarkPlugins ?? defaultRemarkPluginsArray)
    : [remarkGfm, ...(options.remarkPlugins ?? [])];
  return unified()
    .use(remarkParse)
    .use(options.plugins?.cjk?.remarkPluginsBefore ?? [])
    .use(remarkPlugins)
    .use(
      options.disableAutolinkProtocols?.length
        ? [[remarkDisableAutolinkProtocols, options.disableAutolinkProtocols]]
        : [],
    )
    .use(options.plugins?.cjk?.remarkPluginsAfter ?? [])
    .use(options.plugins?.math ? [options.plugins.math.remarkPlugin] : [])
    .use(native && !hasRaw ? [remarkEscapeHtml] : [])
    .use(remarkRehype, {
      allowDangerousHtml: !!native,
      ...options.remarkRehypeOptions,
    })
    .use(native ? rehypePlugins : [])
    .use(
      options.literalTagContent?.length
        ? [[rehypeLiteralTagContent, options.literalTagContent]]
        : [],
    )
    .use(options.plugins?.math ? [options.plugins.math.rehypePlugin] : [])
    .use(native ? [] : rehypePlugins);
}

// Processor configuration is trusted application code. Cache by function/object
// identity, not plugin names or JSON: same-named closures and nonserializable
// options must never share a processor. The bounded LRU stores no source trees.
const processorCache = new Map<string, ReturnType<typeof createProcessor>>();
const identities = new WeakMap<object, number>();
let nextIdentity = 0;
function identity(value: unknown): string {
  if (
    (typeof value === "object" && value !== null) ||
    typeof value === "function"
  ) {
    const object = value as object;
    let id = identities.get(object);
    if (id === undefined) {
      id = ++nextIdentity;
      identities.set(object, id);
    }
    return `ref:${id}`;
  }
  return `${typeof value}:${String(value)}`;
}
function pluginKey(plugins: PluggableList | undefined): unknown[] {
  return (plugins ?? []).map((plugin) =>
    Array.isArray(plugin) ? plugin.map(identity) : identity(plugin),
  );
}
function getCachedProcessor(options: ParseOptions = {}) {
  const key = JSON.stringify([
    !!options.streamdownDefaults,
    options.remarkPlugins === undefined,
    options.rehypePlugins === undefined,
    options.rehypePlugins === defaultRehypePluginsArray,
    pluginKey(options.remarkPlugins),
    pluginKey(options.rehypePlugins),
    identity(options.remarkRehypeOptions),
    options.allowedTags,
    options.literalTagContent,
    options.disableAutolinkProtocols,
    pluginKey(options.plugins?.cjk?.remarkPluginsBefore),
    pluginKey(options.plugins?.cjk?.remarkPluginsAfter),
    pluginKey(options.plugins?.math ? [options.plugins.math.remarkPlugin] : []),
    pluginKey(options.plugins?.math ? [options.plugins.math.rehypePlugin] : []),
  ]);
  const cached = processorCache.get(key);
  if (cached) {
    processorCache.delete(key);
    processorCache.set(key, cached);
    return cached;
  }
  const processor = createProcessor(options);
  processorCache.set(key, processor);
  if (processorCache.size > 100) {
    processorCache.delete(processorCache.keys().next().value!);
  }
  return processor;
}

function sanitizeElementUrls(
  node: Element,
  transform: UrlTransform,
  nodeTransform?: import("./types").StreamdownUrlTransform,
): void {
  const rewrite: UrlTransform = (url, key, tag) =>
    nodeTransform ? nodeTransform(url, key, node) : transform(url, key, tag);
  const properties = node.properties;
  if (!properties) {
    return;
  }
  for (const key in urlAttributes) {
    if (!Object.hasOwn(properties, key)) continue;
    const tags = urlAttributes[key];
    if (tags !== null && !tags.includes(node.tagName)) continue;
    if (
      (node.tagName === "a" && key === "href") ||
      (node.tagName === "img" && key === "src")
    )
      continue;
    const next = rewrite(String(properties[key] || ""), key, node.tagName);
    if (next == null) delete properties[key];
    else properties[key] = next;
  }
  if (node.tagName === "a" && typeof properties.href === "string") {
    const next = rewrite(properties.href, "href", node.tagName);
    if (next == null) {
      delete properties.href;
    } else {
      properties.href = next;
    }
  }
  if (node.tagName === "img") {
    if (typeof properties.src === "string") {
      const next = rewrite(properties.src, "src", node.tagName);
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
          rewrite(url, key, tagName),
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

function postprocessTree(parent: Root | Element, options?: ParseOptions): void {
  for (let index = 0; index < parent.children.length;) {
    const node = parent.children[index];
    if (node.type === "raw") {
      if (options?.skipHtml) {
        parent.children.splice(index, 1);
        continue;
      }
      parent.children[index] = { type: "text", value: node.value };
      index++;
      continue;
    }
    if (node.type !== "element") {
      index++;
      continue;
    }
    if (options?.streamdownDefaults) {
      // Match upstream: harden owns policy; custom transforms see every HTML URL attribute.
      const transform = options.nodeUrlTransform ?? defaultUrlTransform;
      for (const key in urlAttributes) {
        const tags = urlAttributes[key];
        if (
          Object.hasOwn(node.properties, key) &&
          (tags === null || tags.includes(node.tagName))
        ) {
          node.properties[key] =
            transform(String(node.properties[key] || ""), key, node) ??
            undefined;
        }
      }
    } else {
      sanitizeElementUrls(
        node,
        options?.urlTransform ?? defaultSafeUrlTransform,
        options?.nodeUrlTransform,
      );
    }
    const remove = options?.allowedElements
      ? !options.allowedElements.includes(node.tagName)
      : !!options?.disallowedElements?.includes(node.tagName);
    if (
      remove ||
      (options?.allowElement && !options.allowElement(node, index, parent))
    ) {
      parent.children.splice(
        index,
        1,
        ...(options?.unwrapDisallowed ? node.children : []),
      );
      continue;
    }
    postprocessTree(node, options);
    index++;
  }
}

/**
 * Parse a complete document into HAST. Legacy callers retain raw-disabled
 * rendering and the safe tag-name URL callback. With streamdownDefaults,
 * HTML runs through raw → sanitize → harden; custom plugin lists replace the
 * defaults and are trusted. Native nodeUrlTransform is applied afterwards
 * to every applicable html-url-attributes property (default: passthrough).
 * Whole-document repair and custom-tag preparation happen before parsing;
 * block callers may opt out with skipPreprocessing after prepareMarkdown.
 */
export function parseMarkdownTree(
  content: string,
  options?: ParseOptions,
): Root {
  const prepared = options?.skipPreprocessing
    ? content
    : prepareMarkdown(content, options);
  const processor = getCachedProcessor(options);
  const tree = processor.runSync(
    processor.parse(prepared),
    prepared,
  ) as unknown as Root;
  postprocessTree(tree, options);
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
    components: resolveComponentFallback(
      options?.components,
      options?.fallbackComponent,
      options?.allowedTags,
    ) as any,
    passNode: true,
    passKeys: true,
    ignoreInvalidStyle: true,
  }) as JSX.Element;
}
