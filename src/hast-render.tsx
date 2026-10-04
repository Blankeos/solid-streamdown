import { Index, Show, useContext, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Element, ElementContent, Root, RootContent, Text } from "hast";
// Match hast-util-to-jsx-runtime serialization of HTML token-list properties.
import { find, html } from "property-information";
import { stringify as stringifyComma } from "comma-separated-tokens";
import { stringify as stringifySpace } from "space-separated-tokens";
import type { ComponentOverrides } from "./types";

import { FeatureBlock, FeatureContext, fencedCode } from "./feature-block";

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
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
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
      const info = find(html, key);
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
    const info = find(html, key);
    props[info.attribute.startsWith("aria-") ? info.attribute : key] = value;
  }
  if (alignValue && tagName && isTableCell(tagName)) {
    const existing = props.style;
    if (typeof existing === "string") {
      props.style = existing
        ? `${existing};text-align:${alignValue}`
        : `text-align:${alignValue}`;
    } else if (existing && typeof existing === "object") {
      (existing as Record<string, string>).textAlign = alignValue;
    } else {
      props.style = `text-align:${alignValue}`;
    }
  }
  return props;
}

interface HastElementProps {
  element: () => Element;
  components?: ComponentOverrides;
}

const HastHost: Component<HastElementProps> = (props) => {
  const tagName = () => props.element().tagName;
  const override = () =>
    props.components?.[tagName()] as
      Component<Record<string, unknown>> | undefined;
  const component = () => override() ?? tagName();
  const solidProps = (): Record<string, unknown> => {
    const element = props.element();
    const base = toSolidProps(element.properties, tagName());
    // `node` is only for custom component overrides (parity with
    // hast-util-to-jsx-runtime passNode). Native hosts must not receive it
    // or it leaks as node="[object Object]" in the DOM.
    if (override()) {
      return { ...base, node: element };
    }
    return base;
  };
  const children = (): HastChild[] =>
    (props.element().children ?? []) as HastChild[];
  const renderedChildren = (
    <Index each={children()}>
      {(child) => <HastNode node={child} components={props.components} />}
    </Index>
  );

  return (
    <Dynamic component={component()} {...solidProps()}>
      {renderedChildren}
    </Dynamic>
  );
};

const HastElement: Component<HastElementProps> = (props) => {
  const features = useContext(FeatureContext);
  const feature = () =>
    !props.components?.pre &&
    !!features?.plugins &&
    !!fencedCode(props.element());
  return (
    <Show when={feature()} fallback={<HastHost {...props} />}>
      <FeatureBlock element={props.element} />
    </Show>
  );
};

interface HastNodeProps {
  node: () => HastChild;
  components?: ComponentOverrides;
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
      <HastElement element={element} components={props.components} />
    </Show>
  );
};

interface HastRootProps {
  tree: () => Root;
  components?: ComponentOverrides;
}

/** Render a whole hast Root with stable index slots at the top level. */
export const HastRoot: Component<HastRootProps> = (props) => {
  const children = (): HastChild[] =>
    (props.tree().children ?? []) as HastChild[];
  return (
    <Index each={children()}>
      {(child) => <HastNode node={child} components={props.components} />}
    </Index>
  );
};
