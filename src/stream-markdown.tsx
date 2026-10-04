import {
  Show,
  mergeProps,
  createEffect,
  createMemo,
  type Component,
} from "solid-js";
import type { Root } from "hast";
import type {
  AnimatedProp,
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
    <FeatureContext.Provider value={props}>
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

/** Legacy content/stream interface; retains its original defaults. */
export const StreamMarkdown: Component<StreamMarkdownProps> = (props) => (
  <MarkdownCore {...props} />
);

/** Native Solid interface with React Streamdown defaults, sharing the private core. */
export const Streamdown: Component<StreamdownProps> = (props) => {
  const coreProps = mergeProps(
    { parseIncompleteMarkdown: true, isAnimating: false, lineNumbers: true },
    props,
    {
      get content() {
        return props.children ?? "";
      },
      get class() {
        return props.class ?? props.className;
      },
      get showCaret() {
        return props.caret !== undefined;
      },
    },
  );
  return <MarkdownCore {...coreProps} />;
};
