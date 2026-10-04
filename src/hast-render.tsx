import {
  Index,
  Show,
  createSignal,
  useContext,
  type Component,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Element, ElementContent, Root, RootContent, Text } from "hast";
// Match hast-util-to-jsx-runtime serialization of HTML token-list properties.
import { find, html } from "property-information";
import { stringify as stringifyComma } from "comma-separated-tokens";
import { stringify as stringifySpace } from "space-separated-tokens";
import type { ComponentOverrides } from "./types";

import { pinnedScroll } from "./pinned-scroll";
import { BlockControls, tableText, maxHeight } from "./controls";
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
    (!!features?.plugins || features?.controls !== undefined) &&
    !!fencedCode(props.element());
  const [format, setFormat] = createSignal<"csv" | "markdown" | "tsv">(
    "markdown",
  );
  const separator = () => {
    const config = features?.controls;
    const table = typeof config === "object" ? config.table : undefined;
    return typeof table === "object" ? table.csvSeparator : undefined;
  };
  return (
    <Show
      when={
        !props.components?.table &&
        features?.tableMaxHeight !== undefined &&
        props.element().tagName === "table"
      }
      fallback={
        <Show when={feature()} fallback={<HastHost {...props} />}>
          <FeatureBlock element={props.element} />
        </Show>
      }
    >
      <div class="sd-block" data-streamdown="table-wrapper">
        <Show
          when={
            features?.controls !== false &&
            !(
              typeof features?.controls === "object" &&
              features.controls.table === false
            )
          }
        >
          <div class="sd-controls">
            <select
              aria-label={features?.translations?.copyTable ?? "Copy table"}
              disabled={features?.isAnimating}
              value={format()}
              onChange={(event) =>
                setFormat(
                  event.currentTarget.value as "csv" | "markdown" | "tsv",
                )
              }
            >
              <option value="markdown">
                {features?.translations?.tableFormatMarkdown ?? "Markdown"}
              </option>
              <option value="csv">
                {features?.translations?.tableFormatCsv ?? "CSV"}
              </option>
              <option value="tsv">
                {features?.translations?.tableFormatTsv ?? "TSV"}
              </option>
            </select>
            <BlockControls
              kind="table"
              format={format()}
              text={() => tableText(props.element(), format(), separator())}
              extension={format() === "markdown" ? "md" : format()}
            />
          </div>
        </Show>
        <div
          ref={pinnedScroll(
            () => features?.isAnimating ?? false,
            () => !!maxHeight(features?.tableMaxHeight),
          )}
          class="sd-scroll"
          style={{
            "max-height": maxHeight(features?.tableMaxHeight),
            overflow: "auto",
          }}
        >
          <HastHost {...props} />
        </div>
      </div>
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
