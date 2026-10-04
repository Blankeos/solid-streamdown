import { afterEach, describe, expect, it } from "vitest";
import { createSignal, onCleanup, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { Streamdown } from "../src/stream-markdown";
import { Block, type BlockProps } from "../src/block";
import type { Element, Root } from "hast";
import { useIsCodeFenceIncomplete } from "../src/block-incomplete-context";

const disposers: (() => void)[] = [];
function mount(ui: () => JSX.Element) {
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(ui, container);
  disposers.push(() => {
    dispose();
    container.remove();
  });
  return container;
}
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

describe("native block rendering", () => {
  it("passes custom splitting, index, options and block-local incomplete state reactively", () => {
    const [source, setSource] = createSignal("prose\n\n````js\nvalue");
    const seen: BlockProps[] = [];
    const Custom = (props: BlockProps) => {
      seen.push(props);
      return <Block {...props} />;
    };
    const Code = () => {
      const incomplete = useIsCodeFenceIncomplete();
      return <code data-incomplete={incomplete()}>custom</code>;
    };
    const container = mount(() => (
      <Streamdown
        isAnimating
        BlockComponent={Custom}
        components={{ pre: Code }}
        dir="auto"
        parseIncompleteMarkdown={false}
        parseMarkdownIntoBlocksFn={(text) => text.split("\n\n")}
      >
        {source()}
      </Streamdown>
    ));
    expect(seen.length).toBe(2);
    expect(seen[0].index).toBe(0);
    expect(seen[0].content).toBe("prose");
    expect(seen[0].isIncomplete).toBe(false);
    expect(seen[1].isIncomplete).toBe(true);
    expect(seen[1].shouldParseIncompleteMarkdown).toBe(false);
    expect(
      container.querySelector("code")?.getAttribute("data-incomplete"),
    ).toBe("true");
    setSource("prose\n\n````js\nvalue\n````");
    expect(seen.length).toBe(2);
    expect(seen[1].isIncomplete).toBe(false);
    expect(
      container.querySelector("code")?.getAttribute("data-incomplete"),
    ).toBe("false");
  });

  it("does not rerun consumer parsing plugins or replace stable earlier hosts on append", () => {
    const calls: string[] = [];
    const plugin = () => (_tree: unknown, file: { value: unknown }) => {
      calls.push(String(file.value));
    };
    const [source, setSource] = createSignal("first\n\nsecond\n\nthird");
    const container = mount(() => (
      <Streamdown remarkPlugins={[plugin]}>{source()}</Streamdown>
    ));
    const first = container.querySelector("p");
    calls.length = 0;
    setSource("first\n\nsecond\n\nthird grows");
    expect(calls).toEqual(["third grows"]);
    expect(container.querySelector("p")).toBe(first);
  });

  it("resolves late references and footnotes with a document-wide semantic dependency", () => {
    const [source, setSource] = createSignal(
      "Read [guide][manual].\n\nMore prose.",
    );
    const container = mount(() => (
      <Streamdown
        linkSafety={{ enabled: false }}
        parseIncompleteMarkdown={false}
      >
        {source()}
      </Streamdown>
    ));
    expect(container.querySelector("a")).toBeNull();
    setSource(
      "Read [guide][manual].\n\nMore prose.\n\n[manual]: https://example.org/docs",
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.org/docs",
    );
    setSource("A note[^one].\n\n[^one]: Details.");
    const anchor = container.querySelector("sup a");
    expect(anchor).not.toBeNull();
    expect(
      container.querySelector(anchor!.getAttribute("href")!),
    ).not.toBeNull();
  });

  it("static rendering ignores custom split/block hooks and resolves direction per semantic block", () => {
    const never = () => {
      throw new Error("static invoked streaming hook");
    };
    const container = mount(() => (
      <Streamdown
        mode="static"
        dir="auto"
        BlockComponent={never}
        parseMarkdownIntoBlocksFn={never}
      >
        {
          "# Hello\n\nשלום שלום `lots of English code`\n\n- English\n- שלום\n\n```js\nשלום\n```"
        }
      </Streamdown>
    ));
    expect(container.querySelector("h1")?.getAttribute("dir")).toBe("ltr");
    expect(container.querySelector("p")?.getAttribute("dir")).toBe("rtl");
    expect(
      [...container.querySelectorAll("li")].map((li) => li.getAttribute("dir")),
    ).toEqual(["ltr", "rtl"]);
    expect(container.querySelector("[dir=rtl] pre")).toBeNull();
    expect(container.querySelector("pre")).not.toBeNull();
  });

  it("updates auto majority direction without replacing a stable block owner", () => {
    const [source, setSource] = createSignal("English");
    const container = mount(() => (
      <Streamdown dir="auto">{source()}</Streamdown>
    ));
    expect(container.querySelector("div[dir]")?.getAttribute("dir")).toBe(
      "ltr",
    );
    setSource("English שלום שלום שלום");
    expect(container.querySelector("div[dir]")?.getAttribute("dir")).toBe(
      "rtl",
    );
  });
});

it("preserves opaque plugin data callbacks and custom owners through animation revisions", () => {
  const onPing = () => "pong";
  const opaque = document.createElement("span");
  const data = { onPing, opaque };
  const parsed: Element[] = [];
  const plugin = () => (tree: Root) => {
    const paragraph = tree.children[0] as Element;
    paragraph.data = data;
    parsed.push(paragraph);
  };
  const [source, setSource] = createSignal("first word");
  const [animated, setAnimated] = createSignal<boolean | { duration: number }>(
    true,
  );
  const received: (() => string)[] = [];
  let owners = 0;
  let cleaned = 0;
  const container = mount(() => (
    <Streamdown
      animated={animated()}
      rehypePlugins={[plugin]}
      components={{
        p: (props) => {
          owners++;
          onCleanup(() => cleaned++);
          return (
            <p>
              <button
                onClick={() => {
                  const bag = props.node!.data as typeof data;
                  received.push(bag.onPing);
                  expect(bag.opaque).toBe(opaque);
                }}
              >
                ping
              </button>
              {props.children}
            </p>
          );
        },
      }}
    >
      {source()}
    </Streamdown>
  ));
  const paragraph = container.querySelector("p");
  container.querySelector("button")!.click();
  setAnimated({ duration: 210 });
  container.querySelector("button")!.click();
  setSource("first word grows");
  container.querySelector("button")!.click();
  expect(received).toEqual([onPing, onPing, onPing]);
  expect(received[2]()).toBe("pong");
  expect(container.querySelector("p")).toBe(paragraph);
  expect(owners).toBe(1);
  expect(cleaned).toBe(0);
  for (const node of parsed) {
    expect(node.data).toBe(data);
    expect(node.children.every((child) => child.type === "text")).toBe(true);
    expect(node.properties.style).toBeUndefined();
  }
});
