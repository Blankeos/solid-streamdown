import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignal, lazy, useContext, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type { Root } from "hast";
import { defaultComponents } from "../src/public-components";
import { HastRoot } from "../src/hast-render";
import {
  StreamdownContext,
  defaultStreamdownContext,
} from "../src/streamdown-context";
import { FeatureContext } from "../src/streamdown-context";
import { Streamdown, StreamMarkdown } from "../src/stream-markdown";
import type { CodeHighlighterPlugin } from "../src/plugin-types";
import { createCn } from "../src/ui-utils";

const cleanups: (() => void)[] = [];
function mount(ui: () => JSX.Element) {
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(ui, container);
  cleanups.push(() => {
    dispose();
    container.remove();
  });
  return container;
}
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
const code = (value: string) => ({
  type: "element" as const,
  tagName: "code",
  properties: {},
  children: [{ type: "text" as const, value }],
});
const tree: Root = {
  type: "root",
  children: [
    {
      type: "element",
      tagName: "p",
      properties: {},
      children: [code("inline")],
    },
    {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [code("fenced\n")],
    },
  ],
};

describe("composable renderer parity", () => {
  it("recognizes an unlabeled fence through standalone pre composition", () => {
    const Pre = defaultComponents.pre,
      Code = defaultComponents.code;
    const container = mount(() => (
      <StreamdownContext.Provider
        value={{ ...defaultStreamdownContext, controls: false }}
      >
        <Pre>
          <Code>plain code\n</Code>
        </Pre>
        <Code class="language-js">inline</Code>
      </StreamdownContext.Provider>
    ));
    expect(
      container.querySelector('[data-streamdown="code-block"]')?.textContent,
    ).toContain("plain code");
    expect(
      container.querySelector('[data-streamdown="inline-code"]')?.textContent,
    ).toBe("inline");
  });

  it("respects pre and fenced code overrides, reserving inlineCode for inline content", () => {
    const container = mount(() => (
      <HastRoot
        tree={() => tree}
        components={{
          pre: (p) => <article data-custom-pre>{p.children}</article>,
          code: (p) => <mark data-custom-code>{p.children}</mark>,
          inlineCode: (p) => <em data-custom-inline>{p.children}</em>,
        }}
      />
    ));
    expect(container.querySelector("p > em")?.textContent).toBe("inline");
    expect(container.querySelector("article > mark")?.textContent).toBe(
      "fenced\n",
    );
    expect(
      container.querySelector('[data-streamdown="code-block"]'),
    ).toBeNull();
  });

  it("maps string overrides without serializing the HAST node and fills only unknown hosts", () => {
    const customTree: Root = {
      type: "root",
      children: [
        ...tree.children,
        {
          type: "element",
          tagName: "widget",
          properties: { title: "fallback" },
          children: [],
        },
        { type: "element", tagName: "known", properties: {}, children: [] },
      ],
    };
    const container = mount(() => (
      <HastRoot
        tree={() => customTree}
        components={{ code: "mark", known: "aside" }}
        fallbackComponent={(p) => <section title={String(p.title ?? "")} />}
      />
    ));
    expect(container.querySelectorAll("mark")).toHaveLength(2);
    expect(container.querySelector("[node]")).toBeNull();
    expect(container.querySelector("section")?.title).toBe("fallback");
    expect(container.querySelector("aside")).not.toBeNull();
    expect(container.querySelector("p")).not.toBeNull();
  });

  it("normalizes single paragraphs in lists without flattening mixed lists and unwraps images", () => {
    const normalized: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "ul",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "li",
              properties: {},
              children: [
                { type: "text", value: "\n" },
                {
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: [
                    {
                      type: "element",
                      tagName: "input",
                      properties: {
                        type: "checkbox",
                        checked: true,
                        disabled: true,
                      },
                      children: [],
                    },
                    { type: "text", value: " task" },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "li",
              properties: {},
              children: [
                {
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: [{ type: "text", value: "first" }],
                },
                {
                  type: "element",
                  tagName: "ul",
                  properties: {},
                  children: [],
                },
              ],
            },
          ],
        },
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "img",
              properties: { src: "photo.png", alt: "photo" },
              children: [],
            },
          ],
        },
        { type: "element", tagName: "p", properties: {}, children: [] },
        {
          type: "element",
          tagName: "strong",
          properties: {},
          children: [{ type: "text", value: "bold" }],
        },
      ],
    };
    const container = mount(() => <HastRoot tree={() => normalized} />);
    expect(container.querySelector("li > input")?.getAttribute("type")).toBe(
      "checkbox",
    );
    expect(container.querySelectorAll("li > p")).toHaveLength(1);
    expect(container.querySelector("p img")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(
      container.querySelector('span[data-streamdown="strong"]')?.textContent,
    ).toBe("bold");
  });

  it("preserves fence metadata and reactive source for custom language renderers", () => {
    const [text, setText] = createSignal("first");
    const Code = defaultComponents.code,
      Pre = defaultComponents.pre;
    const container = mount(() => (
      <FeatureContext.Provider
        value={{
          plugins: {
            renderers: [
              {
                language: "demo",
                component: (p) => <output data-meta={p.meta}>{p.code}</output>,
              },
            ],
          },
        }}
      >
        <Pre>
          <Code
            node={{
              type: "element",
              tagName: "code",
              properties: {
                className: ["language-demo"],
                metastring: "startLine=12 noLineNumbers",
              },
              children: [{ type: "text", value: text() }],
            }}
          >
            {text()}
          </Code>
        </Pre>
      </FeatureContext.Provider>
    ));
    expect(container.querySelector("output")?.textContent).toBe("first");
    expect(container.querySelector("output")?.getAttribute("data-meta")).toBe(
      "startLine=12 noLineNumbers",
    );
    setText("second");
    expect(container.querySelector("output")?.textContent).toBe("second");
  });

  it("uses reactive provider defaults and merges flattened classes before prefixing", () => {
    const [prefix, setPrefix] = createSignal("tw");
    const Strong = defaultComponents.strong;
    const container = mount(() => (
      <FeatureContext.Provider
        value={{
          get prefix() {
            return prefix();
          },
        }}
      >
        <Strong class="font-normal">text</Strong>
      </FeatureContext.Provider>
    ));
    expect(container.firstElementChild?.className).toBe("tw:font-normal");
    setPrefix("ui");
    expect(container.firstElementChild?.className).toBe("ui:font-normal");
    expect(
      createCn("tw")(["p-2", false], { "p-4": true }, "hover:p-1 hover:p-3"),
    ).toBe("tw:p-4 tw:hover:p-3");
  });
});

describe("renderer fidelity regressions", () => {
  it("normalizes canonical data attributes for hosts and callbacks without mutating HAST", () => {
    const node = {
      type: "element" as const,
      tagName: "widget",
      properties: {
        dataUserId: "user",
        dataBlock: "true",
        ariaLabel: "Widget",
      },
      children: [],
    };
    let received: unknown;
    const container = mount(() => (
      <HastRoot
        tree={() => ({ type: "root", children: [node] })}
        components={{
          widget: (p) => {
            received = p.node;
            return (
              <section
                data-user-id={String(p["data-user-id"])}
                data-block={String(p["data-block"])}
                aria-label={String(p["aria-label"])}
              />
            );
          },
        }}
      />
    ));
    expect(container.querySelector("section")?.dataset.userId).toBe("user");
    expect(container.querySelector("section")?.getAttribute("data-block")).toBe(
      "true",
    );
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Widget",
    );
    expect(received).toBe(node);
    expect(node.properties.dataUserId).toBe("user");
    const raw = mount(() => (
      <Streamdown
        mode="static"
        allowedTags={{ span: ["dataUserId"], widget: ["dataUserId"] }}
      >
        {
          '<span data-user-id="raw">span</span><widget data-user-id="custom">widget</widget>'
        }
      </Streamdown>
    ));
    expect(raw.querySelector("span")?.getAttribute("data-user-id")).toBe("raw");
    expect(raw.querySelector("widget")?.getAttribute("data-user-id")).toBe(
      "custom",
    );
  });

  it("ignores inherited mappings including constructor while honoring own overrides", () => {
    const tree: Root = {
      type: "root",
      children: ["constructor", "widget", "code"].map((tagName) => ({
        type: "element",
        tagName,
        properties: {},
        children: [{ type: "text", value: tagName }],
      })),
    };
    const components = Object.create({
      widget: () => <mark>wrong</mark>,
      inlineCode: () => <mark>wrong</mark>,
      code: () => <mark>wrong</mark>,
    });
    const container = mount(() => (
      <HastRoot
        tree={() => tree}
        components={components}
        fallbackComponent={(p) => <output>{p.children as JSX.Element}</output>}
      />
    ));
    expect(container.querySelectorAll("output")).toHaveLength(2);
    expect(container.textContent).toBe("constructorwidgetcode");
    expect(container.querySelector("mark")).toBeNull();
    expect(
      container.querySelector('[data-streamdown="inline-code"]'),
    ).not.toBeNull();
    const own = mount(() => (
      <HastRoot
        tree={() => tree}
        components={{ constructor: (p) => <aside>{p.children}</aside> }}
      />
    ));
    expect(own.querySelector("aside")?.textContent).toBe("constructor");
  });

  it("forwards standalone and rehype code attributes without leaking internal props", () => {
    const Code = defaultComponents.code;
    const [title, setTitle] = createSignal("source");
    const container = mount(() => (
      <Code
        data-block="true"
        title={title()}
        aria-label="Source"
        dir="rtl"
        className="custom"
      >
        text
      </Code>
    ));
    const body = container.querySelector(
      '[data-streamdown="code-block-body"]',
    )!;
    expect(body.getAttribute("title")).toBe("source");
    expect(body.getAttribute("aria-label")).toBe("Source");
    expect(body.getAttribute("dir")).toBe("rtl");
    expect(body.classList.contains("custom")).toBe(true);
    setTitle("updated source");
    expect(body.getAttribute("title")).toBe("updated source");
    expect(container.querySelector("[node], [data-block]")).toBeNull();
    const enriched = mount(() => (
      <Streamdown
        mode="static"
        rehypePlugins={[
          () => (tree: Root) => {
            const pre = tree.children[0];
            if (pre?.type === "element") {
              const code = pre.children[0];
              if (code?.type === "element")
                Object.assign(code.properties, {
                  title: "plugin",
                  dataUserId: "user",
                  className: ["language-js", "custom"],
                });
            }
          },
        ]}
      >
        {"```js\nvalue\n```"}
      </Streamdown>
    ));
    const enrichedBody = enriched.querySelector(
      '[data-streamdown="code-block-body"]',
    )!;
    expect(enrichedBody.getAttribute("title")).toBe("plugin");
    expect(enrichedBody.getAttribute("data-user-id")).toBe("user");
    expect(enrichedBody.classList.contains("custom")).toBe(true);
    expect(enriched.querySelector("[node], [data-block]")).toBeNull();
  });

  it.each([
    ["startLine=0", 1, true],
    ["startLine=12", 12, true],
    ["notnoLineNumbers", 1, true],
    ["noLineNumbersExtra", 1, true],
    ["noLineNumbers", 1, false],
  ])("handles fence metadata %s", (meta, firstLine, numbered) => {
    const container = mount(() => (
      <Streamdown
        controls={false}
      >{`\`\`\`js ${meta}\nvalue\n\`\`\``}</Streamdown>
    ));
    const line = container.querySelector("[data-line]");
    expect(line?.getAttribute("data-line") ?? null).toBe(
      numbered ? String(firstLine) : null,
    );
  });

  it("locally suspends a lazy renderer while leaving sibling content visible", async () => {
    let resolve!: (module: {
      default: (p: {
        code: string;
        meta?: string;
        isIncomplete: boolean;
      }) => JSX.Element;
    }) => void;
    const Renderer = lazy(
      () =>
        new Promise<{
          default: (p: {
            code: string;
            meta?: string;
            isIncomplete: boolean;
          }) => JSX.Element;
        }>((done) => {
          resolve = done;
        }),
    );
    const container = mount(() => (
      <Streamdown
        isAnimating
        plugins={{ renderers: [{ language: "demo", component: Renderer }] }}
      >
        {"visible sibling\n\n```demo custom-meta\nvalue"}
      </Streamdown>
    ));
    expect(container.querySelector("p")?.textContent).toBe("visible sibling");
    await vi.waitFor(() =>
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull(),
    );
    expect(container.querySelector("output")).toBeNull();
    resolve({
      default: (p) => (
        <output data-meta={p.meta} data-incomplete={String(p.isIncomplete)}>
          {p.code}
        </output>
      ),
    });
    await vi.waitFor(() =>
      expect(container.querySelector("output")?.textContent).toBe("value"),
    );
    expect(container.querySelector("output")?.getAttribute("data-meta")).toBe(
      "custom-meta",
    );
    expect(
      container.querySelector("output")?.getAttribute("data-incomplete"),
    ).toBe("true");
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("resolves root themes from explicit input, replacement providers and native defaults", () => {
    const seen: unknown[] = [];
    const provider = (
      themes: CodeHighlighterPlugin["getThemes"] extends () => infer T
        ? T
        : never,
    ): CodeHighlighterPlugin => ({
      name: "code",
      type: "code-highlighter",
      getThemes: () => themes,
      getSupportedLanguages: () => [],
      supportsLanguage: () => true,
      highlight: (options) => {
        seen.push(options.themes);
        return { tokens: [[{ content: options.code }]] };
      },
    });
    const [plugin, setPlugin] = createSignal(provider(["nord", "nord"]));
    const [theme, setTheme] =
      createSignal<
        CodeHighlighterPlugin["getThemes"] extends () => infer T ? T : never
      >();
    mount(() => (
      <Streamdown shikiTheme={theme()} plugins={{ code: plugin() }}>
        {"```js\nvalue\n```"}
      </Streamdown>
    ));
    expect(seen.at(-1)).toEqual(["nord", "nord"]);
    setPlugin(provider(["dracula", "dracula"]));
    expect(seen.at(-1)).toEqual(["dracula", "dracula"]);
    setTheme(["github-light", "github-dark"]);
    expect(seen.at(-1)).toEqual(["github-light", "github-dark"]);
    setPlugin(provider(["nord", "nord"]));
    expect(seen.at(-1)).toEqual(["github-light", "github-dark"]);
    let fallback: unknown;
    mount(() => (
      <Streamdown
        BlockComponent={() => {
          fallback = useContext(FeatureContext).shikiTheme;
          return <span />;
        }}
      >
        text
      </Streamdown>
    ));
    expect(fallback).toEqual(["github-light", "github-dark"]);
  });

  it("shows deferred, loading and expandable initial Mermaid errors even while streaming", async () => {
    vi.useFakeTimers();
    let intersect!: (entries: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    let reject!: (error: Error) => void;
    const renderChart = vi.fn(
      () =>
        new Promise<{ svg: string }>((_resolve, fail) => {
          reject = fail;
        }),
    );
    try {
      const container = mount(() => (
        <Streamdown
          isAnimating
          plugins={{
            mermaid: {
              name: "mermaid",
              type: "diagram",
              language: "mermaid",
              getMermaid: () => ({ initialize() {}, render: renderChart }),
            },
          }}
        >
          {"```mermaid\ninvalid"}
        </Streamdown>
      ));
      expect(renderChart).not.toHaveBeenCalled();
      expect(
        (
          container.querySelector(
            '[data-streamdown="mermaid"] [style]',
          ) as HTMLElement
        )?.style.minHeight,
      ).toBe("200px");
      expect(container.querySelector("pre")).toBeNull();
      intersect([{ isIntersecting: true }]);
      await vi.advanceTimersByTimeAsync(310);
      expect(container.querySelector('[role="status"]')?.textContent).toBe(
        "Loading diagram...",
      );
      expect(
        container.querySelector('[role="status"] [aria-hidden="true"]'),
      ).not.toBeNull();
      reject(new Error("invalid syntax"));
      await vi.advanceTimersByTimeAsync(0);
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('[role="alert"] p')?.textContent).toBe(
        "Mermaid Error: invalid syntax",
      );
      expect(container.querySelector("summary")?.textContent).toBe("Show Code");
      expect(container.querySelector("details")?.open).toBe(false);
      expect(container.querySelector("details pre")?.textContent).toBe(
        "invalid",
      );
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("invokes an initial streaming Mermaid error override and retries through loading", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const renderChart = vi
      .fn()
      .mockRejectedValueOnce(new Error("invalid syntax"))
      .mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><text>fixed</text></svg>',
      });
    try {
      const container = mount(() => (
        <Streamdown
          isAnimating
          mermaid={{
            errorComponent: (p) => (
              <button onClick={p.retry}>
                {p.error}: {p.chart}
              </button>
            ),
          }}
          plugins={{
            mermaid: {
              name: "mermaid",
              type: "diagram",
              language: "mermaid",
              getMermaid: () => ({ initialize() {}, render: renderChart }),
            },
          }}
        >
          {"```mermaid\nchart"}
        </Streamdown>
      ));
      await vi.waitFor(() =>
        expect(container.querySelector("button")?.textContent).toBe(
          "invalid syntax: chart",
        ),
      );
      container.querySelector("button")!.click();
      await vi.waitFor(() =>
        expect(container.querySelector("svg text")?.textContent).toBe("fixed"),
      );
      expect(renderChart).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("applies prefixed whitespace and edge resets only to the native root", () => {
    const native = mount(() => (
      <Streamdown prefix="tw" className="space-y-2">
        text
      </Streamdown>
    ));
    expect(native.firstElementChild?.className).toContain(
      "tw:whitespace-normal",
    );
    expect(native.firstElementChild?.className).toContain(
      "tw:[&>*:first-child]:mt-0",
    );
    expect(native.firstElementChild?.className).toContain(
      "tw:[&>*:last-child]:mb-0",
    );
    expect(native.firstElementChild?.className).toContain("tw:space-y-2");
    expect(native.firstElementChild?.className).not.toContain("tw:space-y-4");
    const legacy = mount(() => <StreamMarkdown content="text" />);
    expect(legacy.firstElementChild?.className).not.toContain(
      "whitespace-normal",
    );
  });
});

it("renders SVG presentation attributes and namespace integration points from trusted plugins", () => {
  const svgNode = {
    type: "element" as const,
    tagName: "svg",
    properties: { viewBox: "0 0 10 10" },
    children: [
      {
        type: "element" as const,
        tagName: "path",
        properties: {
          strokeLineCap: "round",
          strokeWidth: 2,
          fillRule: "evenodd",
          d: "M0 0L10 10",
        },
        children: [],
      },
      {
        type: "element" as const,
        tagName: "a",
        properties: {},
        children: [
          {
            type: "element" as const,
            tagName: "title",
            properties: {},
            children: [{ type: "text" as const, value: "SVG title" }],
          },
        ],
      },
      {
        type: "element" as const,
        tagName: "foreignObject",
        properties: {},
        children: [
          {
            type: "element" as const,
            tagName: "h1",
            properties: {},
            children: [{ type: "text" as const, value: "HTML" }],
          },
          {
            type: "element" as const,
            tagName: "svg",
            properties: {},
            children: [
              {
                type: "element" as const,
                tagName: "circle",
                properties: { r: 2 },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };
  const plugin = () => (tree: Root) => {
    tree.children = [svgNode];
  };
  const container = mount(() => (
    <Streamdown rehypePlugins={[plugin]}>trusted</Streamdown>
  ));
  const ns = "http://www.w3.org/2000/svg";
  for (const selector of [
    "svg",
    "path",
    "a",
    "title",
    "foreignObject",
    "circle",
  ]) {
    expect(container.querySelector(selector)?.namespaceURI).toBe(ns);
  }
  expect(container.querySelector("h1")?.namespaceURI).toBe(
    "http://www.w3.org/1999/xhtml",
  );
  expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
    "0 0 10 10",
  );
  const path = container.querySelector("path")!;
  expect(path.getAttribute("stroke-linecap")).toBe("round");
  expect(path.getAttribute("stroke-width")).toBe("2");
  expect(path.getAttribute("fill-rule")).toBe("evenodd");
  expect(path.hasAttribute("strokeLineCap")).toBe(false);
  let received: Record<string, unknown> | undefined;
  mount(() => (
    <Streamdown
      rehypePlugins={[plugin]}
      components={{
        path: (props) => {
          received = props;
          return <path stroke-linecap={String(props.strokeLinecap)} />;
        },
      }}
    >
      trusted
    </Streamdown>
  ));
  expect(received?.strokeLinecap).toBe("round");
  expect(received?.strokeWidth).toBe(2);
  expect((received?.node as typeof svgNode).properties).toEqual(
    svgNode.children[0].properties,
  );
  expect(svgNode.children[0].properties.strokeLineCap).toBe("round");
});
