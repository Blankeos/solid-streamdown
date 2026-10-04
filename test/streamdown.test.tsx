import { describe, expect, it } from "vitest";
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { Streamdown } from "../src/index";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import { mermaid } from "@streamdown/mermaid";
import type { PluginConfig, DiagramPlugin } from "../src/plugin-types";

// This assignment also guards compatibility with the actual published contracts.
const plugins: PluginConfig = { code, math, cjk, mermaid };
const mount = (ui: () => JSX.Element) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = render(ui, container);
  return {
    container,
    cleanup: () => {
      dispose();
      container.remove();
    },
  };
};
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 100 && !predicate(); i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  expect(predicate()).toBe(true);
}

describe("Streamdown public interface", () => {
  it("reactively repairs children by default without opting into animation or carets", async () => {
    const [text, setText] = createSignal("**bold");
    const mounted = mount(() => (
      <Streamdown className="custom">{text()}</Streamdown>
    ));
    try {
      expect(
        mounted.container.querySelector("span[data-streamdown=strong]")
          ?.textContent,
      ).toBe("bold");
      expect(mounted.container.querySelector(".custom")).not.toBeNull();
      expect(
        mounted.container.querySelector(".streamdown-streaming"),
      ).toBeNull();
      expect(mounted.container.querySelector(".streamdown-caret")).toBeNull();
      setText("## Next");
      await flush();
      expect(mounted.container.querySelector("h2")?.textContent).toBe("Next");
    } finally {
      mounted.cleanup();
    }
  });

  it("dispatches the published math, CJK and dual-theme code contracts", async () => {
    const [text, setText] = createSignal(
      "**中文。**测试\n\n$$\nx^2\n$$\n\n```js\nconst answer = 42;\n```",
    );
    const mounted = mount(() => (
      <Streamdown plugins={plugins}>{text()}</Streamdown>
    ));
    try {
      expect(
        mounted.container.querySelector("span[data-streamdown=strong]")
          ?.textContent,
      ).toBe("中文。");
      expect(mounted.container.querySelector(".katex math")).not.toBeNull();
      await waitFor(
        () =>
          !!mounted.container.querySelector(
            ".sd-code span[style*='--shiki-dark']",
          ),
      );
      expect(
        mounted.container.querySelector(".sd-code code")?.textContent,
      ).toBe("const answer = 42;");
      setText("```js\nconst updated = 7;\n```");
      await waitFor(
        () =>
          mounted.container.querySelector(".sd-code code")?.textContent ===
            "const updated = 7;" &&
          !!mounted.container.querySelector(
            ".sd-code span[style*='--shiki-dark']",
          ),
      );
      expect(mounted.container.querySelector(".katex")).toBeNull();
    } finally {
      mounted.cleanup();
    }
  });

  it("discards completions from replaced diagram plugins and sanitizes SVG at the native async seam", async () => {
    const requests: {
      source: string;
      resolve: (result: { svg: string }) => void;
    }[] = [];
    const diagram: DiagramPlugin = {
      name: "mermaid",
      type: "diagram",
      language: "mermaid",
      getMermaid: () => ({
        initialize() {},
        render: (_id, source) =>
          new Promise((resolve) => requests.push({ source, resolve })),
      }),
    };
    const [text, setText] = createSignal("```mermaid\nfirst\n```");
    const [plugin, setPlugin] = createSignal(diagram);
    const mounted = mount(() => (
      <Streamdown plugins={{ mermaid: plugin() }}>{text()}</Streamdown>
    ));
    try {
      await flush();
      setText("```mermaid\nsecond\n```");
      setPlugin({ ...diagram });
      await flush();
      expect(requests.map((request) => request.source)).toEqual(["first"]);
      requests[0].resolve({ svg: "<svg><text>first</text></svg>" });
      await flush();
      expect(
        mounted.container.querySelector(
          "[data-streamdown=mermaid] svg:has(text)",
        ),
      ).toBeNull();
      expect(requests.map((request) => request.source)).toEqual([
        "first",
        "second",
      ]);
      requests[1].resolve({
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>second</text><script>alert(1)</script></svg>',
      });
      await flush();
      expect(
        mounted.container.querySelector(
          "[data-streamdown=mermaid] svg:has(text)",
        )?.textContent,
      ).toBe("second");
      expect(mounted.container.querySelector("script")).toBeNull();
      mounted.cleanup();
    } catch (error) {
      mounted.cleanup();
      throw error;
    }
  });
});

it("filters native nodes with parent/index contracts and preserves legacy URL arguments", async () => {
  const { StreamMarkdown } = await import("../src/index");
  const [unwrap, setUnwrap] = createSignal(false);
  const seen: string[] = [];
  const mounted = mount(() => (
    <>
      <Streamdown
        unwrapDisallowed={unwrap()}
        disallowedElements={["strong"]}
        allowElement={(node, index, parent) => {
          if (node.tagName === "em") {
            seen.push(`${index}:${parent?.type}`);
            return false;
          }
          return true;
        }}
      >
        {"Before **hidden** *emphasis* after"}
      </Streamdown>
      <StreamMarkdown
        content="[legacy](https://example.org)"
        urlTransform={(url, key, tag) => `${url}/${tag}/${key}`}
      />
    </>
  ));
  try {
    expect(
      mounted.container.querySelector("span[data-streamdown=strong]"),
    ).toBeNull();
    expect(mounted.container.textContent).not.toContain("hidden");
    expect(seen).toContain("2:element");
    setUnwrap(true);
    await flush();
    expect(mounted.container.textContent).toContain("hidden");
    expect(mounted.container.querySelector("em")).toBeNull();
    expect(mounted.container.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.org/a/href",
    );
  } finally {
    mounted.cleanup();
  }
});

it("supports nested controls and reports clipboard failures through callbacks", async () => {
  const [enabled, setEnabled] = createSignal(false);
  const errors: string[] = [];
  const mounted = mount(() => (
    <Streamdown
      controls={{
        code: {
          download: enabled(),
          copy: { onError: (error) => errors.push(error.message) },
        },
        table: false,
      }}
    >
      {"```text\nsource\n```\n\n| a |\n| --- |\n| b |"}
    </Streamdown>
  ));
  try {
    expect(
      mounted.container.querySelector(
        "[data-streamdown=code-block-download-button]",
      ),
    ).toBeNull();
    expect(mounted.container.querySelector("select")).toBeNull();
    (
      mounted.container.querySelector(
        "[data-streamdown=code-block-copy-button]",
      ) as HTMLButtonElement
    ).click();
    await flush();
    expect(errors).toEqual(["Clipboard API not available"]);
    expect(mounted.container.querySelector("[role=alert]")?.textContent).toBe(
      "Clipboard API not available",
    );
    setEnabled(true);
    await flush();
    expect(
      mounted.container.querySelector(
        "[data-streamdown=code-block-download-button]",
      ),
    ).not.toBeNull();
  } finally {
    mounted.cleanup();
  }
});

it("renders a native Mermaid error override and retries through its public callback", async () => {
  let attempts = 0;
  const plugin: DiagramPlugin = {
    name: "mermaid",
    type: "mermaid",
    language: "mermaid",
    getMermaid: () => ({
      initialize() {},
      render: async () => {
        attempts++;
        if (attempts === 1) throw new Error("Invalid chart");
        return {
          svg: "<svg><text>Recovered</text><script>unsafe()</script></svg>",
        };
      },
    }),
  };
  const mounted = mount(() => (
    <Streamdown
      plugins={{ mermaid: plugin }}
      mermaid={{
        errorComponent: (props) => (
          <button onClick={props.retry}>
            {props.error}: {props.chart}
          </button>
        ),
      }}
    >
      {"```mermaid\nchart\n```"}
    </Streamdown>
  ));
  try {
    await waitFor(() => !!mounted.container.querySelector("button"));
    expect(mounted.container.querySelector("button")?.textContent).toBe(
      "Invalid chart: chart",
    );
    mounted.container.querySelector("button")!.click();
    await waitFor(
      () =>
        mounted.container.querySelector("svg text")?.textContent ===
        "Recovered",
    );
    expect(mounted.container.querySelector("script")).toBeNull();
  } finally {
    mounted.cleanup();
  }
});
