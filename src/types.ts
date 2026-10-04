import type { Component, JSX } from "solid-js";
import type { PluggableList } from "unified";
import type { Options as RemarkRehypeOptions } from "remark-rehype";
import type { UrlTransform } from "./safe-url";
import type { AnimateOptions } from "./animate-plugin";

export type { UrlTransform } from "./safe-url";
export type { AnimateOptions } from "./animate-plugin";

/** Override default HTML element renderers */
export type ComponentOverrides = Partial<{
  [K in keyof JSX.IntrinsicElements]: Component<JSX.IntrinsicElements[K]>;
}> &
  Record<string, Component<Record<string, unknown>>>;

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
   * React parity: `true` repairs whenever `mode` is `"streaming"` (default
   * in React is `true`); `false` disables repair; static mode never repairs
   * even when `true`. When omitted, defaults to `effectiveIsAnimating`
   * (true while animating/streaming, false after settle) so completed
   * strings stay raw by default while explicit `true` keeps a React-parity
   * repaired final. Quarta history passes `true` for consistency.
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
  remarkRehypeOptions?: RemarkRehypeOptions;
  /** Custom URL policy; defaults to rejecting unsafe schemes */
  urlTransform?: UrlTransform;
}

/** React Streamdown 2.7 core interface, with native Solid component overrides. */
export interface StreamdownProps extends Omit<
  StreamMarkdownProps,
  "content" | "stream" | "showCaret"
> {
  children?: string;
  className?: string;
  plugins?: import("./plugin-types").PluginConfig;
  shikiTheme?: [
    import("./plugin-types").ThemeInput,
    import("./plugin-types").ThemeInput,
  ];
  caret?: "block" | "circle";
  dir?: "ltr" | "rtl" | "auto";
  mermaid?: { config?: import("./plugin-types").MermaidConfig };
  lineNumbers?: boolean;
}
