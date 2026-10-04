import {
  createMemo,
  createEffect,
  mergeProps,
  Show,
  type Component,
} from "solid-js";
import type { Root } from "hast";
import { visit } from "unist-util-visit";
import { parseMarkdownTree, type ParseOptions } from "./parser";
import { HastRoot } from "./hast-render";
import { BlockIncompleteContext } from "./block-incomplete-context";
import type { AnimatePlugin } from "./animate-plugin";
import type { StreamdownProps } from "./types";

export { normalizeHtmlIndentation } from "./preprocess";
import { normalizeHtmlIndentation } from "./preprocess";

export type BlockProps = Omit<StreamdownProps, "children" | "dir"> & {
  content: string;
  index: number;
  isIncomplete: boolean;
  shouldParseIncompleteMarkdown: boolean;
  shouldNormalizeHtmlIndentation: boolean;
  dir?: "ltr" | "rtl";
  animatePlugin?: AnimatePlugin | null;
  /** Internal native parser configuration (repair already happened before splitting). */
  parseOptions?: ParseOptions;
  /** Absolute source origin, for reveal identities across block restructuring. */
  sourceOffset?: number;
};

function shiftPositions(tree: Root, offset: number) {
  if (!offset) return;
  visit(tree, (node) => {
    if (node.position) {
      if (node.position.start.offset !== undefined)
        node.position.start.offset += offset;
      if (node.position.end.offset !== undefined)
        node.position.end.offset += offset;
    }
  });
}

/** Copy mutable HAST structure, not opaque plugin data (callbacks, owners, DOM).
 * Animation changes children/properties; extension bags remain consumer-owned.
 */
function copyHast<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  )
    return value;
  if (seen.has(value)) return seen.get(value) as T;
  const copy = (Array.isArray(value) ? [] : Object.create(prototype)) as Record<
    string,
    unknown
  >;
  seen.set(value, copy);
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, {
      value:
        key === "data"
          ? (value as Record<string, unknown>)[key]
          : copyHast((value as Record<string, unknown>)[key], seen),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return copy as T;
}

/** A stable Solid owner with a content-keyed parsing memo, not a remount key. */
export const Block: Component<BlockProps> = (props) => {
  const normalized = createMemo(() =>
    props.shouldNormalizeHtmlIndentation
      ? normalizeHtmlIndentation(props.content)
      : props.content,
  );
  const offset = createMemo(() => props.sourceOffset ?? 0);
  const parserOptions = createMemo(
    () =>
      props.parseOptions ??
      mergeProps(props, {
        streamdownDefaults: true,
        isStreaming: false,
        nodeUrlTransform: props.urlTransform,
      }),
  );
  const baseTree = createMemo(() => {
    const content = normalized();
    const parsed = parseMarkdownTree(content, parserOptions() as ParseOptions);
    shiftPositions(parsed, offset());
    return parsed;
  });
  const tree = createMemo(() => {
    const parsed = copyHast(baseTree());
    props.animatePlugin?.rehypePlugin()(parsed);
    return parsed;
  });
  createEffect(() => {
    tree();
    props.animatePlugin?.commit();
  });
  const Inner = () => <HastRoot tree={tree} components={props.components} />;
  return (
    <BlockIncompleteContext.Provider value={() => props.isIncomplete}>
      <Show when={props.dir} fallback={<Inner />}>
        <div dir={props.dir} style={{ display: "contents" }}>
          <Inner />
        </div>
      </Show>
    </BlockIncompleteContext.Provider>
  );
};
