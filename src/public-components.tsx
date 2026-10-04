import {
  createContext,
  splitProps,
  mergeProps,
  Show,
  useContext,
  type Component,
  type JSX,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Element } from "hast";
import { FeatureBlock } from "./feature-block";
import { Table } from "./table";
import { ImageComponent } from "./image";
import { LinkComponent } from "./link";
import { control, useFeatures, useCn, type HostProps } from "./ui-utils";

const FenceContext = createContext(false);
const classes = {
  ol: [
    "list-inside list-decimal whitespace-normal [li_&]:pl-6",
    "ordered-list",
  ],
  ul: ["list-inside list-disc whitespace-normal [li_&]:pl-6", "unordered-list"],
  li: ["py-1 [&>p]:inline", "list-item"],
  hr: ["my-6 border-border", "horizontal-rule"],
  strong: ["font-semibold", "strong"],
  h1: ["mt-6 mb-2 font-semibold text-3xl", "heading-1"],
  h2: ["mt-6 mb-2 font-semibold text-2xl", "heading-2"],
  h3: ["mt-6 mb-2 font-semibold text-xl", "heading-3"],
  h4: ["mt-6 mb-2 font-semibold text-lg", "heading-4"],
  h5: ["mt-6 mb-2 font-semibold text-base", "heading-5"],
  h6: ["mt-6 mb-2 font-semibold text-sm", "heading-6"],
  thead: ["bg-muted/50", "table-header"],
  tbody: ["divide-y divide-border", "table-body"],
  tr: ["border-b border-border", "table-row"],
  th: ["px-4 py-2 text-left font-semibold", "table-header-cell"],
  td: ["px-4 py-2", "table-cell"],
  blockquote: [
    "my-4 border-l-4 border-border pl-4 text-muted-foreground",
    "blockquote",
  ],
  sup: ["text-xs", "superscript"],
  sub: ["text-xs", "subscript"],
  section: ["", "section"],
} as const;
type DefaultTag =
  keyof typeof classes | "a" | "img" | "table" | "pre" | "code" | "p";
export type DefaultComponents = {
  [Tag in DefaultTag]: Component<
    Omit<HostProps<Tag>, "node"> & { node?: Element; "data-block"?: string }
  >;
};
function styled<Tag extends keyof typeof classes>(
  tag: Tag,
): Component<HostProps<Tag>> {
  return (props) => {
    const p = props as HostProps<"div">;
    const [local, rest] = splitProps(p, [
      "node",
      "className",
      "class",
      "children",
    ]);
    const cn = useCn();
    return (
      <Dynamic
        component={(tag === "strong" ? "span" : tag) as string}
        {...rest}
        class={cn(classes[tag][0], local.className, local.class)}
        data-streamdown={classes[tag][1]}
      >
        {local.children}
      </Dynamic>
    );
  };
}
const Code: DefaultComponents["code"] = (p) => {
  const fence = useContext(FenceContext);
  const cn = useCn();
  const [local, rest] = splitProps(p, [
    "node",
    "children",
    "class",
    "className",
    "data-block",
  ]);
  const node = (): Element => {
    const supplied = local.node as Element | undefined;
    return (
      supplied ?? {
        type: "element",
        tagName: "code",
        properties: {
          className: String(local.className ?? local.class ?? "").split(/\s+/),
        },
        children: [{ type: "text", value: String(local.children ?? "") }],
      }
    );
  };
  const pre = (): Element => {
    const code = node();
    const meta = code.properties.metastring ?? code.data?.meta;
    return {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [
        {
          ...code,
          data: { ...code.data, meta: meta == null ? undefined : String(meta) },
        },
      ],
    };
  };
  return (
    <Show
      when={fence || local["data-block"] !== undefined}
      fallback={
        <code
          {...rest}
          class={cn(
            "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
            local.className,
            local.class,
          )}
          data-streamdown="inline-code"
        >
          {local.children}
        </code>
      }
    >
      <FeatureBlock
        element={pre}
        hostProps={
          mergeProps(rest, {
            get className() {
              return local.className ?? local.class;
            },
          }) as HostProps<"div">
        }
      />
    </Show>
  );
};
const Paragraph: DefaultComponents["p"] = (p) => {
  const [local, rest] = splitProps(p, [
    "node",
    "children",
    "className",
    "class",
  ]);
  const cn = useCn();
  const nodes = () =>
    (local.node as Element | undefined)?.children.filter(
      (n) => n.type !== "text" || n.value !== "",
    );
  const unwrap = () => {
    const children = nodes();
    const only = children?.length === 1 ? children[0] : undefined;
    return (
      only?.type === "element" &&
      (only.tagName === "img" ||
        (only.tagName === "code" &&
          only.properties["data-block"] !== undefined))
    );
  };
  return (
    <Show
      when={
        nodes()?.length !== 0 && local.children !== "" && local.children != null
      }
    >
      <Show when={!unwrap()} fallback={local.children}>
        <p {...rest} class={cn(local.className, local.class)}>
          {local.children}
        </p>
      </Show>
    </Show>
  );
};
export const defaultComponents: DefaultComponents = {
  ol: styled("ol"),
  ul: styled("ul"),
  li: styled("li"),
  hr: styled("hr"),
  strong: styled("strong"),
  h1: styled("h1"),
  h2: styled("h2"),
  h3: styled("h3"),
  h4: styled("h4"),
  h5: styled("h5"),
  h6: styled("h6"),
  thead: styled("thead"),
  tbody: styled("tbody"),
  tr: styled("tr"),
  th: styled("th"),
  td: styled("td"),
  blockquote: styled("blockquote"),
  sup: styled("sup"),
  sub: styled("sub"),
  section: styled("section"),
  a: LinkComponent,
  img: (p) => (
    <ImageComponent
      {...p}
      showControls={!!control("image", "download")()}
      showDownloadControl={!!control("image", "download")()}
    />
  ),
  table: (p) => {
    const c = useFeatures();
    return (
      <Table
        {...p}
        maxHeight={c.tableMaxHeight}
        showControls
        showCopy={!!control("table", "copy")()}
        showDownload={!!control("table", "download")()}
        showFullscreen={!!control("table", "fullscreen")()}
      />
    );
  },
  pre: (p) => (
    <FenceContext.Provider value={true}>{p.children}</FenceContext.Provider>
  ),
  code: Code,
  p: Paragraph,
};
