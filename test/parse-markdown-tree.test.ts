import { describe, expect, it } from "vitest";
import type { Plugin } from "unified";
import type { Element, Root, RootContent } from "hast";
import { parseMarkdown, parseMarkdownTree } from "../src/parser";

function findElements(root: Root, tagName: string): Element[] {
  const found: Element[] = [];
  const visit = (nodes: RootContent[] | Element["children"]) => {
    for (const node of nodes) {
      if (node.type !== "element") {
        continue;
      }
      if (node.tagName === tagName) {
        found.push(node);
      }
      visit(node.children);
    }
  };
  visit(root.children);
  return found;
}

function textOf(root: Root): string {
  let out = "";
  const visit = (nodes: RootContent[] | Element["children"]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        out += node.value;
      } else if (node.type === "element") {
        visit(node.children);
      }
    }
  };
  visit(root.children);
  return out;
}

describe("parseMarkdownTree", () => {
  it("returns a hast Root for empty content", () => {
    const tree = parseMarkdownTree("");
    expect(tree.type).toBe("root");
    expect(tree.children).toEqual([]);
  });

  it("drops dangerous link hrefs but keeps safe ones", () => {
    const dangerous = parseMarkdownTree("[click](javascript:alert(1))");
    const links = findElements(dangerous, "a");
    expect(links).toHaveLength(1);
    expect(links[0].properties?.href).toBeUndefined();

    const safe = parseMarkdownTree("[click](https://example.com)");
    expect(findElements(safe, "a")[0].properties?.href).toBe(
      "https://example.com",
    );
  });

  it("rejects data: and vbscript: link targets", () => {
    const data = parseMarkdownTree("[x](data:text/html,hi)");
    expect(findElements(data, "a")[0].properties?.href).toBeUndefined();

    const vbscript = parseMarkdownTree("[x](vbscript:msgbox(1))");
    expect(findElements(vbscript, "a")[0].properties?.href).toBeUndefined();
  });

  it("drops dangerous image sources but keeps relative ones", () => {
    const dangerous = parseMarkdownTree("![x](javascript:alert(1))");
    const images = findElements(dangerous, "img");
    expect(images).toHaveLength(1);
    expect(images[0].properties?.src).toBeUndefined();

    const relative = parseMarkdownTree("![photo](./images/photo.jpg)");
    expect(findElements(relative, "img")[0].properties?.src).toBe(
      "./images/photo.jpg",
    );
  });

  it("sanitizes img srcSet (canonical) and srcset (legacy alias)", () => {
    const withCanonicalSrcSet: Plugin = () => (tree: Root) => {
      const visit = (node: any) => {
        if (node.type === "element" && node.tagName === "img") {
          node.properties.srcSet =
            "data:evil 1x, https://example.com/safe.jpg 2x";
        }
        for (const child of node.children ?? []) {
          visit(child);
        }
      };
      visit(tree);
    };
    const canonical = parseMarkdownTree("![x](https://example.com/a.jpg)", {
      rehypePlugins: [withCanonicalSrcSet],
    });
    expect(findElements(canonical, "img")[0].properties?.srcSet).toBe(
      "https://example.com/safe.jpg 2x",
    );

    const withLegacySrcset: Plugin = () => (tree: Root) => {
      const visit = (node: any) => {
        if (node.type === "element" && node.tagName === "img") {
          node.properties.srcset =
            "data:evil 1x, https://example.com/safe.jpg 2x";
        }
        for (const child of node.children ?? []) {
          visit(child);
        }
      };
      visit(tree);
    };
    const legacy = parseMarkdownTree("![x](https://example.com/a.jpg)", {
      rehypePlugins: [withLegacySrcset],
    });
    expect(findElements(legacy, "img")[0].properties?.srcset).toBe(
      "https://example.com/safe.jpg 2x",
    );
  });

  it("applies a custom urlTransform to img srcSet (intentional override)", () => {
    const withSrcSet: Plugin = () => (tree: Root) => {
      const visit = (node: any) => {
        if (node.type === "element" && node.tagName === "img") {
          node.properties.srcSet = "https://example.com/safe.jpg 2x";
        }
        for (const child of node.children ?? []) {
          visit(child);
        }
      };
      visit(tree);
    };
    const tree = parseMarkdownTree("![x](https://example.com/a.jpg)", {
      rehypePlugins: [withSrcSet],
      urlTransform: (url, key) =>
        key === "srcSet"
          ? `https://proxy/?u=${encodeURIComponent(url)}`
          : url,
    });
    expect(findElements(tree, "img")[0].properties?.srcSet).toBe(
      "https://proxy/?u=https%3A%2F%2Fexample.com%2Fsafe.jpg 2x",
    );
  });

  it("keeps the streaming sentinel markers when repairing", () => {
    const link = parseMarkdownTree("[label](https://exam", {
      isStreaming: true,
    });
    const links = findElements(link, "a");
    expect(links).toHaveLength(1);
    expect(links[0].properties?.href).toBe("streamdown:incomplete-link");

    const image = parseMarkdownTree("![alt](https://exam", {
      isStreaming: true,
    });
    const images = findElements(image, "img");
    expect(images).toHaveLength(1);
    expect(images[0].properties?.src).toBe("streamdown:incomplete-image");
  });

  it("repairs incomplete emphasis only when streaming", () => {
    const streaming = parseMarkdownTree("Hello **world", { isStreaming: true });
    expect(findElements(streaming, "strong")).toHaveLength(1);

    const settled = parseMarkdownTree("Hello **world");
    expect(findElements(settled, "strong")).toHaveLength(0);
  });

  it("closes unclosed code fences when streaming", () => {
    const tree = parseMarkdownTree("```js\nconst x = 1;", {
      isStreaming: true,
    });
    expect(findElements(tree, "code")).toHaveLength(1);
  });

  it("honors a custom urlTransform", () => {
    const tree = parseMarkdownTree("[x](https://example.com)", {
      urlTransform: (url) =>
        url.startsWith("https://")
          ? `https://proxy/?u=${encodeURIComponent(url)}`
          : url,
    });
    expect(findElements(tree, "a")[0].properties?.href).toBe(
      "https://proxy/?u=https%3A%2F%2Fexample.com",
    );
  });

  it("a custom urlTransform can drop attributes", () => {
    const tree = parseMarkdownTree("[x](https://example.com)", {
      urlTransform: () => undefined,
    });
    expect(findElements(tree, "a")[0].properties?.href).toBeUndefined();
  });

  it("applies remarkPlugins after GFM", () => {
    const shout: Plugin = () => (tree: any) => {
      const visit = (node: any) => {
        if (node.type === "text" && typeof node.value === "string") {
          node.value = node.value.toUpperCase();
        }
        for (const child of node.children ?? []) {
          visit(child);
        }
      };
      visit(tree);
    };
    const tree = parseMarkdownTree("hello **world**", {
      remarkPlugins: [shout],
    });
    expect(textOf(tree)).toBe("HELLO WORLD");
    // GFM parsing still applied around the custom plugin
    expect(findElements(tree, "strong")).toHaveLength(1);
  });

  it("applies rehypePlugins to the hast tree", () => {
    const markParagraphs: Plugin = () => (tree: any) => {
      const visit = (node: any) => {
        if (node.type === "element" && node.tagName === "p") {
          node.properties["data-tested"] = "yes";
        }
        for (const child of node.children ?? []) {
          visit(child);
        }
      };
      visit(tree);
    };
    const tree = parseMarkdownTree("hello", { rehypePlugins: [markParagraphs] });
    expect(findElements(tree, "p")[0].properties?.["data-tested"]).toBe("yes");
  });

  it("drops raw HTML without a raw-HTML plugin", () => {
    const tree = parseMarkdownTree(
      "<script>alert(1)</script>\n\nHello",
      { isStreaming: false },
    );
    expect(findElements(tree, "script")).toHaveLength(0);
    expect(textOf(tree)).toContain("Hello");
  });
});

describe("parseMarkdown legacy entry", () => {
  it("renders sanitized content through the JSX path", () => {
    expect(parseMarkdown("")).toBeNull();
    expect(parseMarkdown("[x](javascript:alert(1))")).toBeTruthy();
    expect(parseMarkdown("# Title", { isStreaming: true })).toBeTruthy();
  });
});
