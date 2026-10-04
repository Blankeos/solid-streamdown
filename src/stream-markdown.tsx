import {
  Show,
  Index,
  onCleanup,
  mergeProps,
  createEffect,
  createMemo,
  type Component,
} from "solid-js";
import type { Root } from "hast";
import type {
  AnimatedProp,
  ComponentOverrides,
  StreamMarkdownProps,
  StreamdownProps,
} from "./types";
import { parseMarkdownTree } from "./parser";
import {
  createAnimatePlugin,
  createAnimateTimeline,
  type AnimatePlugin,
  type AnimateTimeline,
} from "./animate-plugin";
import { FeatureContext } from "./feature-block";
import { HastRoot } from "./hast-render";
import { Dynamic } from "solid-js/web";
import { prepareMarkdown } from "./parser";
import { Block, normalizeHtmlIndentation, type BlockProps } from "./block";
import { rehypeBlockDirection } from "./block-direction";
import { detectTextDirection } from "./detect-direction";
import { hasIncompleteCodeFence, hasTable } from "./incomplete-code-utils";
import { parseMarkdownIntoBlocks } from "./utils/parse-blocks";
import type { ParseOptions } from "./parser";
import { defaultComponents } from "./public-components";
import { createCn } from "./ui-utils";
import { defaultStreamdownContext } from "./streamdown-context";

const normalizeAnimatedKey = (animated: AnimatedProp | undefined): string => {
  if (animated === true) {
    return "true";
  }
  if (animated && typeof animated === "object") {
    try {
      return JSON.stringify(animated);
    } catch {
      return "true";
    }
  }
  return "";
};

const getMaxBacklogMs = (
  animated: AnimatedProp | undefined,
): number | undefined => {
  if (animated && typeof animated === "object" && "maxBacklogMs" in animated) {
    const value = (animated as { maxBacklogMs?: unknown }).maxBacklogMs;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
};

const getPluginOptions = (
  animated: AnimatedProp | undefined,
): Record<string, unknown> => {
  if (animated === true) {
    return {};
  }
  const options = (animated as Record<string, unknown> | undefined) ?? {};
  const { maxBacklogMs: _ignored, ...rest } = options;
  return rest;
};

interface CoreProps extends StreamMarkdownProps {
  controls?: StreamdownProps["controls"];
  translations?: StreamdownProps["translations"];
  icons?: StreamdownProps["icons"];
  codeBlockMaxHeight?: number | string;
  tableMaxHeight?: number | string;
  nodeUrlTransform?: StreamdownProps["urlTransform"];
  allowedElements?: StreamdownProps["allowedElements"];
  disallowedElements?: StreamdownProps["disallowedElements"];
  allowElement?: StreamdownProps["allowElement"];
  unwrapDisallowed?: boolean;
  plugins?: StreamdownProps["plugins"];
  shikiTheme?: StreamdownProps["shikiTheme"];
  mermaid?: StreamdownProps["mermaid"];
  lineNumbers?: boolean;
  dir?: StreamdownProps["dir"];
  caret?: StreamdownProps["caret"];
}

const MarkdownCore: Component<CoreProps> = (props) => {
  const markdown = createMemo(() => {
    if (props.stream) {
      return props.stream.content();
    }
    return props.content ?? "";
  });

  const mode = () => props.mode ?? "streaming";

  const effectiveIsAnimating = createMemo(() => {
    if (mode() === "static") {
      return false;
    }
    if (props.isAnimating !== undefined) {
      return props.isAnimating;
    }
    return props.stream?.isStreaming() ?? false;
  });

  const animatedKey = createMemo(() => normalizeAnimatedKey(props.animated));

  const shouldAnimate = createMemo(() => {
    if (mode() === "static") {
      return false;
    }
    if (!effectiveIsAnimating()) {
      return false;
    }
    return animatedKey().length > 0;
  });

  // Repair policy (React-compatible):
  // - static mode never repairs, even with explicit opt-in.
  // - explicit parseIncompleteMarkdown true/false wins in streaming mode
  //   (true keeps a repaired final after stream.end, matching React default).
  // - omitted defaults to effectiveIsAnimating so completed strings stay raw
  //   by default and stream.end unrepairs to the previous raw final.
  const shouldRepair = () => {
    if (mode() === "static") {
      return false;
    }
    if (props.parseIncompleteMarkdown !== undefined) {
      return props.parseIncompleteMarkdown;
    }
    return effectiveIsAnimating();
  };

  // Persistent animation wiring keyed by animated *values* (not reference) so
  // inline `animated={{ ... }}` literals with identical JSON don't reset the
  // shared wall-clock timeline. Timeline + plugin survive appends; they are
  // recreated only when the value key changes or when the stream restarts,
  // resets, or backtracks (non-append edit) so new streams don't inherit the
  // previous committed count.
  let cachedAnimatedKey = "";
  let cachedPlugin: AnimatePlugin | null = null;
  let cachedTimeline: AnimateTimeline | null = null;
  let prevMarkdown: string | null = null;
  let prevActive = false;

  const tree = createMemo<Root>(() => {
    const content = markdown();
    const repair = shouldRepair();
    const parsed = parseMarkdownTree(content, {
      isStreaming: repair,
      plugins: props.plugins,
      remarkPlugins: props.remarkPlugins,
      rehypePlugins: props.rehypePlugins,
      remarkRehypeOptions: props.remarkRehypeOptions,
      urlTransform: props.urlTransform,
      nodeUrlTransform: props.nodeUrlTransform,
      allowedElements: props.allowedElements,
      disallowedElements: props.disallowedElements,
      allowElement: props.allowElement,
      unwrapDisallowed: props.unwrapDisallowed,
    });
    const active = shouldAnimate();
    const key = animatedKey();
    if (active && key) {
      const raw = props.animated;
      if (cachedAnimatedKey !== key || !cachedPlugin || !cachedTimeline) {
        cachedTimeline = createAnimateTimeline({
          maxBacklogMs: getMaxBacklogMs(raw),
        });
        cachedPlugin = createAnimatePlugin({
          ...getPluginOptions(raw),
          timeline: cachedTimeline,
        } as Parameters<typeof createAnimatePlugin>[0]);
        cachedAnimatedKey = key;
      } else {
        const isAppend =
          prevMarkdown !== null &&
          content.length >= prevMarkdown.length &&
          content.startsWith(prevMarkdown);
        const needsReset = !prevActive || !isAppend;
        if (needsReset) {
          cachedTimeline = createAnimateTimeline({
            maxBacklogMs: getMaxBacklogMs(raw),
          });
          cachedPlugin = createAnimatePlugin({
            ...getPluginOptions(raw),
            timeline: cachedTimeline,
          } as Parameters<typeof createAnimatePlugin>[0]);
        }
      }
      cachedTimeline.beginPass(cachedTimeline.now());
      cachedPlugin.rehypePlugin()(parsed);
      prevMarkdown = content;
      prevActive = true;
    } else {
      prevMarkdown = content;
      prevActive = false;
    }
    return parsed;
  });

  // Commit the shared cascade after rendering; unit history retains absolute
  // start/end times so a replaced or reinserted host resumes rather than replays.
  createEffect(() => {
    tree();
    if (shouldAnimate() && cachedPlugin && cachedTimeline) {
      cachedPlugin.commit();
      cachedTimeline.commitPass();
    }
  });

  const isEmpty = createMemo(() => markdown().length === 0);

  // Fire animation callbacks only on isAnimating transitions, never in static
  // mode. First mount with true fires start; mount with false fires nothing.
  // Static still records prev so static -> streaming transitions fire correctly.
  let previousIsAnimating: boolean | null = null;
  createEffect(() => {
    const currentMode = mode();
    const current = effectiveIsAnimating();
    if (currentMode === "static") {
      previousIsAnimating = current;
      return;
    }
    const start = props.onAnimationStart;
    const end = props.onAnimationEnd;
    if (previousIsAnimating === null) {
      previousIsAnimating = current;
      if (current) {
        start?.();
      }
      return;
    }
    if (current && !previousIsAnimating) {
      previousIsAnimating = current;
      start?.();
    } else if (!current && previousIsAnimating) {
      previousIsAnimating = current;
      end?.();
    }
  });

  const caretVisible = createMemo(() => {
    if (mode() === "static") {
      return false;
    }
    return effectiveIsAnimating() && (props.showCaret ?? true);
  });

  return (
    <FeatureContext.Provider
      value={mergeProps(
        {
          controls: false,
          linkSafety: { enabled: false },
          lineNumbers: false,
          codeBlockMaxHeight: 0,
          tableMaxHeight: 0,
        },
        props,
        {
          get isAnimating() {
            return effectiveIsAnimating();
          },
        },
      )}
    >
      <div
        dir={props.dir}
        data-caret={props.caret}
        class={props.class}
        classList={{
          streamdown: true,
          "streamdown-streaming": effectiveIsAnimating(),
          "streamdown-caret": caretVisible(),
        }}
      >
        <HastRoot tree={tree} components={props.components} />
        <Show when={isEmpty() && caretVisible()}>
          <span />
        </Show>
      </div>
    </FeatureContext.Provider>
  );
};

// Legacy HTML hosts remain semantic and preserve original HAST attributes.
// Fenced code and table keep the feature renderers; caller overrides still win.
const legacyComponents = Object.fromEntries(
  Object.keys(defaultComponents)
    .filter((tag) => !["pre", "code", "table"].includes(tag))
    .map((tag) => [tag, tag]),
) as ComponentOverrides;

/** Legacy content/stream interface; retains its original defaults. */
export const StreamMarkdown: Component<StreamMarkdownProps> = (props) => (
  <MarkdownCore
    {...props}
    components={{ ...legacyComponents, ...props.components }}
  />
);

/** Native interface: stable per-index owners and content-keyed parser memos. */
export const Streamdown: Component<StreamdownProps> = (input) => {
  const props = mergeProps(
    {
      ...defaultStreamdownContext,
      mode: "streaming" as const,
      parseIncompleteMarkdown: true,
      isAnimating: false,
      lineNumbers: true,
      controls: true,
      codeBlockMaxHeight: 400,
      tableMaxHeight: 300,
      linkSafety: { enabled: true },
    },
    input,
  );
  const source = createMemo(() => props.children ?? "");
  const active = () => props.mode !== "static" && props.isAnimating;
  const prepared = createMemo(() =>
    prepareMarkdown(source(), {
      isStreaming: props.mode !== "static" && props.parseIncompleteMarkdown,
      remend: props.remend,
      allowedTags: props.allowedTags,
      literalTagContent: props.literalTagContent,
    }),
  );
  // Definitions are document dependencies: a late definition can change earlier
  // inline nodes. Footnotes similarly require one mdast tree. Do not parse them
  // as isolated blocks with invented caches or duplicated footnote sections.
  const documentDependent = createMemo(
    () =>
      /^ {0,3}\[[^\]]+\]:/m.test(prepared()) ||
      /\[\^[\w-]{1,200}\]/.test(prepared()),
  );
  const blocks = createMemo(() => {
    if (props.mode === "static") return [prepared()];
    if (documentDependent() && !props.parseMarkdownIntoBlocksFn)
      return [prepared()];
    return (props.parseMarkdownIntoBlocksFn ?? parseMarkdownIntoBlocks)(
      prepared(),
    );
  });
  const incompleteBlocks = createMemo(() =>
    blocks().map(
      (content, index) =>
        active() &&
        index === blocks().length - 1 &&
        hasIncompleteCodeFence(content),
    ),
  );
  const offsets = createMemo(() => {
    let offset = 0;
    return blocks().map((content) => {
      const found = prepared().indexOf(content, offset);
      const start = found < 0 ? offset : found;
      offset = start + content.length;
      return start;
    });
  });
  const options = createMemo<ParseOptions>(() => ({
    streamdownDefaults: true,
    isStreaming: false,
    skipPreprocessing: true,
    skipHtml: props.skipHtml,
    plugins: props.plugins,
    remarkPlugins: props.remarkPlugins,
    rehypePlugins: props.rehypePlugins,
    remarkRehypeOptions: props.remarkRehypeOptions,
    nodeUrlTransform: props.urlTransform,
    allowedElements: props.allowedElements,
    disallowedElements: props.disallowedElements,
    allowElement: props.allowElement,
    unwrapDisallowed: props.unwrapDisallowed,
    allowedTags: props.allowedTags,
    literalTagContent: props.literalTagContent,
    disableAutolinkProtocols: props.disableAutolinkProtocols,
  }));
  // Builtin, explicit, inlineCode and fallback precedence belongs to HastRoot.
  // Keep its explicit map unchanged: proxying every absent tag would override
  // builtin components rather than fill genuinely missing entries.
  const components = createMemo(() => props.components);
  const key = createMemo(() => normalizeAnimatedKey(props.animated));
  let previousKey = "";
  let timeline: AnimateTimeline | undefined;
  let animationPlugins: AnimatePlugin[] = [];
  let previousSource: string | null = null;
  let wasActive = false;
  const animation = createMemo(() => {
    const value = key();
    const content = source();
    const enabled = active() && !!value;
    const isAppend =
      previousSource !== null && content.startsWith(previousSource);
    const reset =
      value !== previousKey || (enabled && (!wasActive || !isAppend));
    previousSource = content;
    wasActive = enabled;
    if (reset) {
      previousKey = value;
      animationPlugins = [];
      timeline = value
        ? createAnimateTimeline({
            maxBacklogMs: getMaxBacklogMs(props.animated),
          })
        : undefined;
    }
    // One shared source-identity history survives splitting/merging boundaries.
    // Each block schedules against the same committed wall-clock horizon.
    if (!active() || !value || !timeline) return null;
    return { timeline, options: getPluginOptions(props.animated) };
  });
  const animateFor = () => {
    const config = animation();
    if (!config) return null;
    return (animationPlugins[0] ??= createAnimatePlugin({
      ...config.options,
      timeline: config.timeline,
    }));
  };
  const pass = createMemo(() => {
    blocks();
    animation()?.timeline.beginPass(animation()!.timeline.now());
    return blocks();
  });
  createEffect(() => {
    pass();
    animation()?.timeline.commitPass();
  });
  let previous: boolean | null = null;
  createEffect(() => {
    if (props.mode === "static") return;
    const current = props.isAnimating;
    if (current && previous !== true) props.onAnimationStart?.();
    else if (!current && previous === true) props.onAnimationEnd?.();
    previous = current;
  });
  const staticTree = createMemo(() => {
    if (props.mode !== "static") return { type: "root", children: [] } as Root;
    const parsed = parseMarkdownTree(
      props.normalizeHtmlIndentation
        ? normalizeHtmlIndentation(prepared())
        : prepared(),
      options(),
    );
    if (props.dir === "auto") rehypeBlockDirection()(parsed);
    return parsed;
  });
  let container: HTMLDivElement | undefined;
  let host: Element | undefined;
  const caretVisible = () => active() && !!props.caret;
  createEffect(() => {
    pass();
    staticTree();
    caretVisible();
    host?.removeAttribute("data-sd-caret");
    host?.removeAttribute("data-sd-caret-hidden");
    host = undefined;
    if (!container || !caretVisible()) return;
    const last = blocks().at(-1) ?? "";
    const hidden = hasIncompleteCodeFence(last) || hasTable(last);
    // display:contents wrappers don't own rendered text. Walk to a real final
    // text host, excluding fenced code and table control chrome.
    const candidates = container.querySelectorAll(
      "p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,table",
    );
    host =
      candidates[candidates.length - 1] ??
      container.lastElementChild ??
      undefined;
    if (host)
      host.setAttribute(
        hidden || host.closest("pre,table")
          ? "data-sd-caret-hidden"
          : "data-sd-caret",
        props.caret!,
      );
  });
  onCleanup(() => {
    host?.removeAttribute("data-sd-caret");
    host?.removeAttribute("data-sd-caret-hidden");
  });
  return (
    <FeatureContext.Provider
      value={mergeProps(props, {
        get shikiTheme() {
          return (
            input.shikiTheme ??
            input.plugins?.code?.getThemes() ??
            defaultStreamdownContext.shikiTheme
          );
        },
        get isAnimating() {
          return active();
        },
      })}
    >
      <div
        ref={container}
        dir={props.dir === "auto" ? undefined : props.dir}
        data-caret={props.caret}
        class={createCn(props.prefix)(
          "space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          props.class ?? props.className,
        )}
        classList={{
          streamdown: true,
          "streamdown-streaming": active(),
          "streamdown-caret": caretVisible(),
        }}
      >
        <Show
          when={props.mode !== "static"}
          fallback={<HastRoot tree={staticTree} components={components()} />}
        >
          <Index each={pass()}>
            {(content, index) => (
              <Dynamic
                component={props.BlockComponent ?? Block}
                {...props}
                components={components()}
                content={content()}
                index={index}
                shouldParseIncompleteMarkdown={props.parseIncompleteMarkdown}
                shouldNormalizeHtmlIndentation={
                  props.normalizeHtmlIndentation ?? false
                }
                isIncomplete={incompleteBlocks()[index]}
                dir={
                  props.dir === "auto"
                    ? detectTextDirection(content())
                    : props.dir
                }
                parseOptions={options()}
                sourceOffset={offsets()[index]}
                animatePlugin={animateFor()}
              />
            )}
          </Index>
        </Show>
        <Show when={!source() && caretVisible()}>
          <span data-sd-caret={props.caret} />
        </Show>
      </div>
    </FeatureContext.Provider>
  );
};
