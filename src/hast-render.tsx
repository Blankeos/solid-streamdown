import {
  Index,
  Show,
  createMemo,
  untrack,
  sharedConfig,
  type JSX,
  type Component,
} from "solid-js";
import {
  Dynamic,
  isServer,
  ssrElement,
  getNextElement,
  spread,
  SVGElements,
} from "solid-js/web";
import type { Element, ElementContent, Root, RootContent, Text } from "hast";
// Match hast-util-to-jsx-runtime serialization of HTML token-list properties.
import { find, html, svg, hastToReact } from "property-information";
import { stringify as stringifyComma } from "comma-separated-tokens";
import { stringify as stringifySpace } from "space-separated-tokens";
import type { ComponentOverrides } from "./types";

import { useFeatures } from "./ui-utils";
import { defaultComponents } from "./public-components";
type HastChild = RootContent | ElementContent;

const isElementNode = (node: HastChild): node is Element =>
  node.type === "element";

const isTableCell = (tagName: string): boolean =>
  tagName === "td" || tagName === "th";

/**
 * Convert hast properties to Solid DOM props.
 * `className` (hast) becomes `class`; array token lists serialize via the
 * property-information HTML schema (space-separated unless `commaSeparated`,
 * matching hast-util-to-jsx-runtime); `align` on td/th becomes
 * `text-align` style for React parity. Everything else passes through,
 * including `data-*` animation vars and boolean form attrs.
 */
function toSolidProps(
  properties: Element["properties"],
  tagName?: string,
  namespace: "html" | "svg" = "html",
  custom = false,
): Record<string, unknown> {
  const props: Record<string, unknown> = Object.create(null);
  if (!properties) {
    return props;
  }
  let alignValue: string | undefined;
  for (const key of Object.keys(properties)) {
    let value = (properties as Record<string, unknown>)[key];
    if (value == null) {
      continue;
    }
    if (key === "className") {
      props.class = Array.isArray(value)
        ? stringifySpace(value as Array<string | number>)
        : value;
      continue;
    }
    if (key === "class") {
      props.class = Array.isArray(value)
        ? stringifySpace(value as Array<string | number>)
        : value;
      continue;
    }
    if (Array.isArray(value)) {
      const info = find(namespace === "svg" ? svg : html, key);
      value = info.commaSeparated
        ? stringifyComma(value as Array<string | number>)
        : stringifySpace(value as Array<string | number>);
    }
    if (
      tagName &&
      isTableCell(tagName) &&
      key === "align" &&
      typeof value === "string"
    ) {
      alignValue = value;
      continue;
    }
    const info = find(namespace === "svg" ? svg : html, key);
    props[
      namespace === "svg"
        ? custom && info.space === "svg"
          ? Object.hasOwn(hastToReact, info.property)
            ? hastToReact[info.property]
            : info.property
          : info.attribute
        : !info.space || info.attribute.startsWith("aria-")
          ? info.attribute
          : key
    ] = value;
  }
  if (alignValue && tagName && isTableCell(tagName)) {
    const existing = props.style;
    if (typeof existing === "string") {
      props.style = existing
        ? `${existing};text-align:${alignValue}`
        : `text-align:${alignValue}`;
    } else if (existing && typeof existing === "object") {
      props.style = { ...existing, "text-align": alignValue };
    } else {
      props.style = `text-align:${alignValue}`;
    }
  }
  return props;
}

interface HastElementProps {
  element: () => Element;
  components?: ComponentOverrides;
  parentTag?: string;
  namespace?: "html" | "svg";
  fallbackComponent?: Component<Record<string, unknown>>;
}

const HastHost: Component<HastElementProps> = (props) => {
  const context = useFeatures();
  const tagName = createMemo(() => props.element().tagName);
  const namespace = createMemo(() =>
    tagName().toLowerCase() === "svg" ? "svg" : (props.namespace ?? "html"),
  );
  const childNamespace = () =>
    namespace() === "svg" && tagName().toLowerCase() === "foreignobject"
      ? "html"
      : namespace();
  const inFence = () => props.parentTag === "pre";
  const own = (map: ComponentOverrides | undefined, key: string) =>
    map && Object.hasOwn(map, key) ? map[key] : undefined;
  const override = () =>
    tagName() === "code" && !inFence()
      ? (own(props.components, "inlineCode") ?? own(props.components, "code"))
      : own(props.components, tagName());
  const builtin = () =>
    namespace() === "html" ? own(defaultComponents, tagName()) : undefined;
  const component = () =>
    override() ??
    builtin() ??
    (namespace() === "svg" ? tagName() : undefined) ??
    (/^[a-z][a-z0-9-]*$/.test(tagName())
      ? (props.fallbackComponent ?? context.fallbackComponent ?? tagName())
      : tagName());
  const solidProps = (): Record<string, unknown> => {
    const element = props.element();
    const custom = typeof component() === "function";
    const base = toSolidProps(
      element.properties,
      tagName(),
      namespace(),
      custom,
    );
    return {
      ...base,
      ...(custom ? { node: element } : {}),
      ...(tagName() === "code" && inFence() ? { "data-block": "true" } : {}),
    };
  };
  const children = (): HastChild[] => {
    const nodes = props.element().children as HastChild[];
    if (tagName() !== "li" || override()) return nodes;
    const valid = nodes.filter(
      (n) => n.type !== "text" || (n.value !== "\n" && n.value !== ""),
    );
    const only = valid.length === 1 ? valid[0] : undefined;
    return only?.type === "element" && only.tagName === "p"
      ? (only.children as HastChild[])
      : nodes;
  };
  const renderedChildren = (
    <Index each={children()}>
      {(child) => (
        <HastNode
          node={child}
          components={props.components}
          parentTag={tagName()}
          namespace={childNamespace()}
          fallbackComponent={props.fallbackComponent}
        />
      )}
    </Index>
  );

  // Solid Dynamic guesses SVG from a tag allowlist, which misses SVG a/title
  // and cannot handle HTML integration points. Carry the HAST namespace instead.
  const NativeHost: Component<Record<string, unknown>> = (hostProps) => {
    const nativeTag = () => {
      const rawTag = component() as string;
      return namespace() === "svg"
        ? ([...SVGElements].find(
            (name) => name.toLowerCase() === rawTag.toLowerCase(),
          ) ?? rawTag)
        : rawTag;
    };
    if (isServer)
      return ssrElement(
        nativeTag(),
        hostProps,
        undefined,
        true,
      ) as unknown as JSX.Element;
    return createMemo(() => {
      const tag = nativeTag();
      const isSvg = namespace() === "svg";
      const create = () =>
        isSvg
          ? document.createElementNS("http://www.w3.org/2000/svg", tag)
          : document.createElement(tag);
      const element = sharedConfig.context ? getNextElement(create) : create();
      untrack(() => spread(element, hostProps, isSvg));
      return element;
    }) as unknown as JSX.Element;
  };
  return (
    <Dynamic
      component={typeof component() === "string" ? NativeHost : component()}
      {...solidProps()}
    >
      {renderedChildren}
    </Dynamic>
  );
};

const HastElement: Component<HastElementProps> = (props) => (
  <HastHost {...props} />
);

interface HastNodeProps {
  node: () => HastChild;
  components?: ComponentOverrides;
  parentTag?: string;
  namespace?: "html" | "svg";
  fallbackComponent?: Component<Record<string, unknown>>;
}

/**
 * Render one hast child. Slots are index-stable: parents always use `<Index>`
 * so appends reuse existing paragraph/text/word DOM instead of remounting.
 * Node accessors keep props reactive without caching rendered output.
 */
const HastNode: Component<HastNodeProps> = (props) => {
  const node = () => props.node();
  const element = () => node() as Element;
  const textValue = () => (node() as Text).value;
  return (
    <Show when={isElementNode(node())} fallback={textValue()}>
      {/* Only animation units get a session key. Resetting CSS animation history
          must replace those units, not their semantic hosts. Within a session
          the key stays fixed, retaining both DOM and native Animation objects. */}
      <Show
        keyed
        when={element().properties["data-sd-animation-session"] ?? true}
      >
        <HastElement
          element={element}
          components={props.components}
          parentTag={props.parentTag}
          namespace={props.namespace}
          fallbackComponent={props.fallbackComponent}
        />
      </Show>
    </Show>
  );
};

interface HastRootProps {
  tree: () => Root;
  components?: ComponentOverrides;
  parentTag?: string;
  namespace?: "html" | "svg";
  fallbackComponent?: Component<Record<string, unknown>>;
}

/** Render a whole hast Root with stable index slots at the top level. */
export const HastRoot: Component<HastRootProps> = (props) => {
  const children = (): HastChild[] =>
    (props.tree().children ?? []) as HastChild[];
  return (
    <Index each={children()}>
      {(child) => (
        <HastNode
          node={child}
          components={props.components}
          fallbackComponent={props.fallbackComponent}
        />
      )}
    </Index>
  );
};
