import { describe, expect, it } from "vitest";
import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { urlAttributes } from "html-url-attributes";
import { parseMarkdownTree } from "../src/parser";
import { resolveComponentFallback } from "../src/component-fallback";
import { prepareMarkdown } from "../src/preprocess";

function elements(tree: Root | Element): Element[] {
  return tree.children.flatMap((node) =>
    node.type === "element" ? [node, ...elements(node)] : [],
  );
}
function text(tree: Root | Element): string {
  return tree.children
    .map((node) =>
      node.type === "text"
        ? node.value
        : node.type === "element"
          ? text(node)
          : "",
    )
    .join("");
}
const native = { streamdownDefaults: true };

describe("Markdown pipeline parity", () => {
  it("parses safe HTML while removing scripts, event handlers, and executable URLs", () => {
    const tree = parseMarkdownTree(
      '<div><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><a href="java&#x09;script:alert(1)">bad</a><a href="https://example.com">good</a></div>',
      native,
    );
    const nodes = elements(tree);
    expect(nodes.some((node) => node.tagName === "div")).toBe(true);
    expect(nodes.some((node) => node.tagName === "script")).toBe(false);
    expect(
      nodes.find((node) => node.tagName === "img")?.properties.src,
    ).toBeUndefined();
    expect(
      nodes.find((node) => node.tagName === "img")?.properties.onError,
    ).toBeUndefined();
    const links = nodes.filter((node) => node.tagName === "a");
    expect(links).toHaveLength(1);
    expect(links[0].properties.href).toBe("https://example.com/");
    expect(text(tree)).toContain("bad [blocked]");
  });

  it("preserves legacy raw-disabled parsing and its tag-name URL callback", () => {
    expect(elements(parseMarkdownTree("<div>raw</div>"))).toHaveLength(0);
    const observed: string[] = [];
    const tree = parseMarkdownTree(
      "[link](javascript:alert) ![img](https://example.com/a.png)",
      {
        urlTransform: (url, key, tag) => {
          observed.push(`${tag}:${key}`);
          return url.startsWith("javascript:") ? undefined : url;
        },
      },
    );
    expect(observed).toEqual(["a:href", "img:src"]);
    expect(
      elements(tree).find((node) => node.tagName === "a")?.properties.href,
    ).toBeUndefined();
  });

  it("keeps footnote anchors aligned and applies the upstream raw ID clobber policy", () => {
    const tree = parseMarkdownTree(
      'Note[^1].\n\n[^1]: body\n\n<div id="location" name="location">raw</div>',
      native,
    );
    const nodes = elements(tree);
    const targets = new Set(nodes.map((node) => node.properties.id));
    for (const node of nodes.filter((node) =>
      String(node.properties.href).startsWith("#user-content-"),
    )) {
      expect(targets.has(String(node.properties.href).slice(1))).toBe(true);
    }
    expect(targets.has("user-content-fn-1")).toBe(true);
    // Upstream explicitly disables the sanitizer prefix to avoid double-prefixing footnotes.
    expect(targets.has("location")).toBe(true);
  });

  it("extends only default sanitization for custom tags, preserves literal labels and code examples", () => {
    const source =
      '<mention user_id="42">_some_username_</mention>\n\n```html\n<mention>_code_</mention>\n```';
    const tree = parseMarkdownTree(source, {
      ...native,
      allowedTags: { mention: ["user_id"] },
      literalTagContent: ["mention"],
    });
    const nodes = elements(tree);
    expect(text(nodes.find((node) => node.tagName === "mention")!)).toBe(
      "_some_username_",
    );
    expect(
      nodes.find((node) => node.tagName === "mention")?.properties.user_id,
    ).toBe("42");
    expect(text(nodes.find((node) => node.tagName === "code")!)).toBe(
      "<mention>_code_</mention>\n",
    );
    const custom = parseMarkdownTree("<mention>x</mention>", {
      ...native,
      allowedTags: { mention: [] },
      rehypePlugins: [],
    });
    expect(elements(custom).some((node) => node.tagName === "mention")).toBe(
      false,
    );
    expect(text(custom)).toContain("<mention>x</mention>");
  });

  it("parses custom multiline and unclosed containers and normalizes HTML indentation", () => {
    for (const source of ["<panel>\n**bold**\n</panel>", "<panel>\n**bold**"]) {
      const tree = parseMarkdownTree(source, {
        ...native,
        allowedTags: { panel: [] },
      });
      expect(elements(tree).some((node) => node.tagName === "panel")).toBe(
        true,
      );
      expect(elements(tree).some((node) => node.tagName === "strong")).toBe(
        true,
      );
    }
    expect(
      elements(
        parseMarkdownTree("    <div>ok</div>", {
          ...native,
          normalizeHtmlIndentation: true,
        }),
      ).some((node) => node.tagName === "div"),
    ).toBe(true);
  });

  it("supports selective remend configuration and preserves code metadata", () => {
    expect(
      elements(
        parseMarkdownTree("**open", { ...native, isStreaming: true }),
      ).some((node) => node.tagName === "strong"),
    ).toBe(true);
    expect(
      elements(
        parseMarkdownTree("**open", {
          ...native,
          isStreaming: true,
          remend: { bold: false },
        }),
      ).some((node) => node.tagName === "strong"),
    ).toBe(false);
    expect(
      elements(parseMarkdownTree("```js startLine=10\nhi\n```", native)).find(
        (node) => node.tagName === "code",
      )?.properties.metastring,
    ).toBe("startLine=10");
    expect(
      prepareMarkdown("```\n<mention>_x_</mention>\n```", {
        literalTagContent: ["mention"],
      }),
    ).toBe("```\n<mention>_x_</mention>\n```");
  });

  it("disables only automatic protocol links, not explicit matching resource links", () => {
    const tree = parseMarkdownTree(
      "foo@example.com <mailto:bar@example.com> [foo@example.com](mailto:foo@example.com) https://example.com",
      { ...native, disableAutolinkProtocols: [" MAILTO:"] },
    );
    const links = elements(tree).filter((node) => node.tagName === "a");
    // Upstream's structural test leaves <mailto:...> intact: its label includes the scheme.
    expect(links.map((node) => node.properties.href)).toEqual([
      "mailto:bar@example.com",
      "mailto:foo@example.com",
      "https://example.com/",
    ]);
  });

  it("transforms every applicable HTML URL attribute after trusted user plugins", () => {
    const injected: Element[] = [];
    for (const [key, tags] of Object.entries(urlAttributes)) {
      injected.push({
        type: "element",
        tagName: tags?.[0] ?? "span",
        properties: { [key]: "javascript:alert(1)" },
        children: [],
      });
    }
    const plugin: Plugin<[], Root> = () => (tree) => {
      tree.children = injected;
    };
    const seen: string[] = [];
    const tree = parseMarkdownTree("input", {
      ...native,
      rehypePlugins: [plugin],
      nodeUrlTransform: (url, key, node) => {
        seen.push(key);
        expect(node.properties[key]).toBe(url);
        return undefined;
      },
    });
    expect(new Set(seen)).toEqual(new Set(Object.keys(urlAttributes)));
    for (const node of elements(tree))
      for (const value of Object.values(node.properties))
        expect(value).toBeUndefined();
    const trusted = parseMarkdownTree("input", {
      ...native,
      rehypePlugins: [
        () => (root: Root) => {
          root.children = [
            {
              type: "element",
              tagName: "a",
              properties: { href: "javascript:trusted" },
              children: [],
            },
          ];
        },
      ],
    });
    expect(elements(trusted)[0].properties.href).toBe("javascript:trusted");
  });

  it("filters and recursively unwraps rejected elements, and removes raw nodes when requested", () => {
    const tree = parseMarkdownTree("**bold** and *italic*", {
      ...native,
      disallowedElements: ["p", "strong"],
      unwrapDisallowed: true,
    });
    expect(elements(tree).map((node) => node.tagName)).toEqual(["em"]);
    expect(text(tree)).toBe("bold and italic");
    const raw: Plugin<[], Root> = () => (root) => {
      root.children = [{ type: "raw", value: "<script>unsafe</script>" }];
    };
    expect(
      parseMarkdownTree("x", {
        ...native,
        rehypePlugins: [raw],
        skipHtml: true,
      }).children,
    ).toHaveLength(0);
    expect(
      text(parseMarkdownTree("x", { ...native, rehypePlugins: [raw] })),
    ).toBe("<script>unsafe</script>");
  });
  it("keeps same-named plugin closures and option identities independent in the bounded cache", () => {
    const marker = (value: string): Plugin<[], Root> =>
      function sameName() {
        return (tree) => {
          tree.children = [{ type: "text", value }];
        };
      };
    let attached = 0;
    const stable: Plugin<[], Root> = () => {
      attached++;
      return (tree, file) => {
        tree.children = [{ type: "text", value: String(file.value) }];
      };
    };
    expect(
      text(parseMarkdownTree("one", { ...native, rehypePlugins: [stable] })),
    ).toBe("one");
    expect(
      text(parseMarkdownTree("two", { ...native, rehypePlugins: [stable] })),
    ).toBe("two");
    expect(attached).toBe(1);
    const first = marker("first");
    const second = marker("second");
    expect(
      text(parseMarkdownTree("x", { ...native, rehypePlugins: [first] })),
    ).toBe("first");
    expect(
      text(parseMarkdownTree("x", { ...native, rehypePlugins: [second] })),
    ).toBe("second");
    const withOptions: Plugin<
      [{ label: string; format: () => string }],
      Root
    > = (options) => (tree) => {
      tree.children = [
        { type: "text", value: options.label + options.format() },
      ];
    };
    const a = { label: "label", format: () => "A" };
    const b = { label: "label", format: () => "B" };
    for (const [options, expected] of [
      [a, "labelA"],
      [b, "labelB"],
    ] as const) {
      expect(
        text(
          parseMarkdownTree("x", {
            ...native,
            rehypePlugins: [[withOptions, options]],
          }),
        ),
      ).toBe(expected);
    }
    // Exercise eviction through the public parser, without a test-only cache API.
    for (let index = 0; index < 105; index++) {
      const value = String(index);
      expect(
        text(
          parseMarkdownTree("x", { ...native, rehypePlugins: [marker(value)] }),
        ),
      ).toBe(value);
    }
    expect(
      text(parseMarkdownTree("x", { ...native, rehypePlugins: [first] })),
    ).toBe("first");
  });

  it("runs CJK before/default/after/math and literal content before math HAST plugins", () => {
    const append =
      (value: string): Plugin<[], import("mdast").Root> =>
      () =>
      (tree) => {
        const paragraph = tree.children.find(
          (node) => node.type === "paragraph",
        );
        if (paragraph?.type === "paragraph")
          paragraph.children.push({ type: "text", value });
      };
    const tree = parseMarkdownTree("input", {
      ...native,
      remarkPlugins: [append(" default")],
      plugins: {
        cjk: {
          name: "cjk",
          type: "cjk",
          remarkPlugins: [],
          remarkPluginsBefore: [append(" before")],
          remarkPluginsAfter: [append(" after")],
        },
        math: {
          name: "katex",
          type: "math",
          remarkPlugin: append(" math"),
          rehypePlugin: () => (root: Root) => {
            root.children.push({ type: "text", value: " rehype" });
          },
        },
      },
    });
    expect(text(tree)).toBe("input before default after math rehype");
    const literal = parseMarkdownTree("<mention>_literal_</mention>", {
      ...native,
      allowedTags: { mention: [] },
      literalTagContent: ["mention"],
      plugins: {
        math: {
          name: "katex",
          type: "math",
          remarkPlugin: append(""),
          rehypePlugin: () => (root: Root) => {
            const mention = elements(root).find(
              (node) => node.tagName === "mention",
            )!;
            mention.children.push({
              type: "element",
              tagName: "strong",
              properties: {},
              children: [{ type: "text", value: " math" }],
            });
          },
        },
      },
    });
    expect(text(literal)).toBe("_literal_ math");
    expect(elements(literal).some((node) => node.tagName === "strong")).toBe(
      true,
    );
  });

  it("sanitizes hostile HTML inside allowed custom containers without stripping allowed data", () => {
    const tree = parseMarkdownTree(
      '<panel data-id="42" onclick="alert(1)"><script>attack()</script><iframe src="https://evil.example"></iframe><a href="javascript:attack()">bad</a><img src="javascript:attack()" onerror="attack()"></panel>',
      {
        ...native,
        allowedTags: { panel: ["dataId"] },
      },
    );
    const nodes = elements(tree);
    expect(nodes.map((node) => node.tagName)).toEqual([
      "p",
      "panel",
      "span",
      "span",
    ]);
    expect(nodes.find((node) => node.tagName === "panel")?.properties).toEqual({
      dataId: "42",
    });
    expect(
      nodes.some((node) =>
        Object.keys(node.properties).some((key) => /^(on|src|href)/i.test(key)),
      ),
    ).toBe(false);
    expect(text(tree)).toBe("bad [blocked][Image blocked: No description]");
  });
  it("resolves fallback components for unknown and allowed tags while explicit mappings win", () => {
    const fallback = () => "fallback";
    const explicit = () => "explicit";
    const components = resolveComponentFallback(
      { mention: explicit, a: "a" },
      fallback,
      { mention: [], panel: [] },
    );
    expect(components.mention).toBe(explicit);
    expect(components.a).toBe("a");
    expect(components.panel).toBe(fallback);
    expect(components["unknown-tag"]).toBe(fallback);
    expect(Object.hasOwn(components, "unknown-tag")).toBe(true);
    expect(Object.hasOwn(components, "UnknownTag")).toBe(false);
  });
});
