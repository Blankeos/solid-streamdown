/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Native public contracts adapted from Streamdown 2.7.0; component types use Solid.
 */
import type { Element, Parents } from "hast";
import type {
  ControlsConfig,
  StreamdownTranslations,
  IconMap,
} from "./controls";
import type { Component, JSX } from "solid-js";
import type { PluggableList } from "unified";
import type { Options as RemarkRehypeOptions } from "remark-rehype";
import type { UrlTransform as LegacyUrlTransform } from "./safe-url";
import type { AnimateOptions } from "./animate-plugin";

export type { UrlTransform as LegacyUrlTransform } from "./safe-url";
/** Native Streamdown callback receives the complete HAST element. */
export type UrlTransform = StreamdownUrlTransform;
export type { AnimateOptions } from "./animate-plugin";

/** HAST node supplied to custom renderers. */
export interface ExtraProps {
  node?: Element | undefined;
}
export type AllowElement = (
  element: Readonly<Element>,
  index: number,
  parent: Readonly<Parents> | undefined,
) => boolean | null | undefined;
export type Components = {
  [K in keyof JSX.IntrinsicElements]?:
    | Component<JSX.IntrinsicElements[K] & ExtraProps>
    | keyof JSX.IntrinsicElements;
} & {
  inlineCode?: Component<JSX.IntrinsicElements["code"] & ExtraProps>;
  [key: string]: Component<any> | keyof JSX.IntrinsicElements | undefined;
};
export type ComponentOverrides = Components;
export type AllowedTags = Record<string, string[]>;
export type Options = {
  allowElement?: AllowElement;
  allowedElements?: readonly string[];
  children?: string;
  components?: Components;
  disallowedElements?: readonly string[];
  rehypePlugins?: PluggableList;
  remarkPlugins?: PluggableList;
  remarkRehypeOptions?: Readonly<RemarkRehypeOptions>;
  skipHtml?: boolean;
  unwrapDisallowed?: boolean;
  urlTransform?: StreamdownUrlTransform;
};
export type BlockProps = Options & {
  content: string;
  shouldParseIncompleteMarkdown: boolean;
  shouldNormalizeHtmlIndentation: boolean;
  index: number;
  isIncomplete: boolean;
  dir?: "ltr" | "rtl";
  animatePlugin?: import("./animate-plugin").AnimatePlugin | null;
};
export type PortalTarget = HTMLElement | (() => HTMLElement | null) | null;
export interface LinkSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  url: string;
}
export interface LinkSafetyConfig {
  enabled: boolean;
  onLinkCheck?: (url: string) => Promise<boolean> | boolean;
  renderModal?: (props: LinkSafetyModalProps) => JSX.Element;
}

export interface MarkdownStreamOptions {
  /** Initial content before streaming begins */
  initialContent?: string;
}

export interface MarkdownStream {
  /** Append a chunk of markdown text */
  write(chunk: string): void;
  /** Signal that the stream is complete */
  end(): void;
  /** Current accumulated content (reactive signal) */
  content: () => string;
  /** Whether the stream is still active (reactive signal) */
  isStreaming: () => boolean;
  /** Reset the stream for reuse */
  reset(): void;
}

/** Rendering mode. `static` disables repair, animation, and callbacks. */
export type StreamdownMode = "streaming" | "static";

/** Opt-in word animation. `true` uses fadeIn/150ms/ease/word/40ms stagger. */
export type AnimatedProp = boolean | AnimateOptions;

export interface StreamMarkdownProps {
  /** Static markdown content */
  content?: string;
  /** Streaming markdown source */
  stream?: MarkdownStream;
  /** Custom component overrides for rendered elements */
  components?: ComponentOverrides;
  /** CSS class applied to the wrapper element */
  class?: string;
  /** Show caret animation while streaming (default: true) */
  showCaret?: boolean;
  /** Rendering mode (default: "streaming"). Static disables repair/animation/callbacks. */
  mode?: StreamdownMode;
  /** Explicit animating flag. Overrides `stream.isStreaming()` when set. */
  isAnimating?: boolean;
  /** Opt-in streaming word animation (default: false). */
  animated?: AnimatedProp;
  /**
   * Enable remend repair for incomplete markdown.
   * Native parity: `true` repairs whenever `mode` is `"streaming"` (default
   * in Streamdown is `true`); `false` disables repair; static mode never repairs
   * even when `true`. When omitted, defaults to `effectiveIsAnimating`
   * (true while animating/streaming, false after settle) so completed
   * strings stay raw by default while explicit `true` keeps a upstream-parity
   * repaired final. Consumers can pass `true` for consistent history rendering.
   */
  parseIncompleteMarkdown?: boolean;
  /** Called when animating transitions false → true (suppressed in static mode). */
  onAnimationStart?: () => void;
  /** Called when animating transitions true → false (suppressed in static mode). */
  onAnimationEnd?: () => void;
  /** Extra remark plugins, applied after GFM */
  remarkPlugins?: PluggableList;
  /** Extra rehype plugins, applied after the mdast-to-hast step */
  rehypePlugins?: PluggableList;
  /** Overrides for the mdast-to-hast conversion */
  remarkRehypeOptions?: Readonly<RemarkRehypeOptions>;
  /** Custom URL policy; defaults to rejecting unsafe schemes */
  urlTransform?: LegacyUrlTransform;
}

/** Streamdown 2.7 core interface, with native Solid component overrides. */
export interface StreamdownProps extends Omit<
  StreamMarkdownProps,
  "content" | "stream" | "showCaret" | "urlTransform"
> {
  children?: string;
  BlockComponent?: Component<BlockProps>;
  parseMarkdownIntoBlocksFn?: (markdown: string) => string[];
  normalizeHtmlIndentation?: boolean;
  allowedTags?: AllowedTags;
  literalTagContent?: string[];
  disableAutolinkProtocols?: string[];
  fallbackComponent?: Component<Record<string, unknown> & ExtraProps>;
  remend?: import("remend").RemendOptions;
  skipHtml?: boolean;
  linkSafety?: LinkSafetyConfig;
  portal?: PortalTarget;
  prefix?: string;
  className?: string;
  plugins?: import("./plugin-types").PluginConfig;
  shikiTheme?: [
    import("./plugin-types").ThemeInput,
    import("./plugin-types").ThemeInput,
  ];
  caret?: "block" | "circle";
  dir?: "ltr" | "rtl" | "auto";
  controls?: ControlsConfig;
  translations?: Partial<StreamdownTranslations>;
  icons?: Partial<IconMap>;
  codeBlockMaxHeight?: number | string;
  tableMaxHeight?: number | string;
  urlTransform?: StreamdownUrlTransform;
  allowedElements?: readonly string[];
  disallowedElements?: readonly string[];
  allowElement?: AllowElement;
  unwrapDisallowed?: boolean;
  mermaid?: MermaidOptions;
  lineNumbers?: boolean;
}

export type StreamdownUrlTransform = (
  url: string,
  key: string,
  node: Readonly<Element>,
) => string | null | undefined;
export interface MermaidErrorComponentProps {
  chart: string;
  error: string;
  retry: () => void;
}

export interface MermaidOptions {
  config?: import("./plugin-types").MermaidConfig;
  errorComponent?: Component<MermaidErrorComponentProps>;
}
