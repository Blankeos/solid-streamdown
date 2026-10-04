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
      expect(mounted.container.querySelector("strong")?.textContent).toBe(
        "bold",
      );
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
      expect(mounted.container.querySelector("strong")?.textContent).toBe(
        "中文。",
      );
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

  it("discards stale diagram completions and sanitizes SVG at the native async seam", async () => {
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
    const mounted = mount(() => (
      <Streamdown plugins={{ mermaid: diagram }}>{text()}</Streamdown>
    ));
    try {
      await flush();
      setText("```mermaid\nsecond\n```");
      await flush();
      expect(requests.map((request) => request.source)).toEqual([
        "first",
        "second",
      ]);
      requests[1].resolve({
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>second</text><script>alert(1)</script></svg>',
      });
      await flush();
      requests[0].resolve({ svg: "<svg><text>first</text></svg>" });
      await flush();
      expect(mounted.container.querySelector("svg")?.textContent).toBe(
        "second",
      );
      expect(mounted.container.querySelector("script")).toBeNull();
      mounted.cleanup();
    } catch (error) {
      mounted.cleanup();
      throw error;
    }
  });
});
