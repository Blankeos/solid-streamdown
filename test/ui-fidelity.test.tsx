import { afterEach, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal, type JSX } from "solid-js";
import { FeatureContext } from "../src/streamdown-context";
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockSkeleton,
} from "../src/code-block";
import { LinkComponent } from "../src/link";
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function mount(ui: () => JSX.Element) {
  const root = document.createElement("div");
  document.body.append(root);
  dispose = render(ui, root);
  return root;
}
it("standalone code retains containment, floating actions, prefix merging and valid line defaults", () => {
  const root = mount(() => (
    <FeatureContext.Provider value={{ prefix: "tw" }}>
      <CodeBlock code={"a\nb"} language="js" startLine={0}>
        <CodeBlockCopyButton className="p-2" />
      </CodeBlock>
      <CodeBlockSkeleton />
    </FeatureContext.Provider>
  ));
  expect(
    root.querySelector('[data-streamdown="code-block"]')?.getAttribute("style"),
  ).toContain("content-visibility: auto");
  expect(
    root.querySelector('[data-streamdown="code-block-copy-button"]')?.className,
  ).toContain("tw:p-2");
  expect(root.querySelector(".sd-code-actions")?.className).toContain(
    "tw:absolute",
  );
  expect(
    [...root.querySelectorAll("[data-line]")].map((n) =>
      n.getAttribute("data-line"),
    ),
  ).toEqual(["1", "2"]);
});
it.each([true, false])(
  "incomplete links reactively expose boolean state (safety %s)",
  (safety) => {
    const [url, setUrl] = createSignal("streamdown:incomplete-link");
    const root = mount(() => (
      <FeatureContext.Provider value={{ linkSafety: { enabled: safety } }}>
        <LinkComponent href={url()}>link</LinkComponent>
      </FeatureContext.Provider>
    ));
    const link = root.querySelector('[data-streamdown="link"]')!;
    expect(link.getAttribute("data-incomplete")).toBe("true");
    setUrl("https://example.com");
    expect(link.getAttribute("data-incomplete")).toBe("false");
  },
);
it("custom link confirmation opens without forcing the consumer modal to close", () => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  const root = mount(() => (
    <FeatureContext.Provider
      value={{
        linkSafety: {
          enabled: true,
          renderModal: (p) => (
            <div data-open={p.isOpen}>
              <button onClick={p.onConfirm}>confirm</button>
              <button onClick={p.onClose}>close</button>
            </div>
          ),
        },
      }}
    >
      <LinkComponent href="https://example.com">link</LinkComponent>
    </FeatureContext.Provider>
  ));
  root.querySelector("button")!.click();
  // The asynchronous link check resolves in a microtask.
  return Promise.resolve().then(() => {
    const modal = root.querySelector("[data-open]")!;
    expect(modal.getAttribute("data-open")).toBe("true");
    root.querySelectorAll("button")[1].click();
    expect(open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noreferrer",
    );
    expect(modal.getAttribute("data-open")).toBe("true");
    root.querySelectorAll("button")[2].click();
    expect(modal.getAttribute("data-open")).toBe("false");
  });
});

it("merges reactive caller code styles with internal defaults for objects and CSS strings", () => {
  const [style, setStyle] = createSignal<JSX.CSSProperties | string>({
    color: "red",
  });
  const root = mount(() => (
    <CodeBlock code="x" language="js" style={style()} />
  ));
  const body = root.querySelector<HTMLElement>(
    '[data-streamdown="code-block-body"]',
  )!;
  expect(body.style.maxHeight).toBe("400px");
  expect(body.style.overflow).toBe("auto");
  expect(body.style.color).toBe("red");
  setStyle({ "max-height": "73px", color: "blue" });
  expect(body.style.maxHeight).toBe("73px");
  expect(body.style.overflow).toBe("auto");
  expect(body.style.color).toBe("blue");
  setStyle("max-height:91px;color:green;overflow:visible");
  expect(body.style.maxHeight).toBe("91px");
  expect(body.style.color).toBe("green");
  expect(body.style.overflow).toBe("visible");
  setStyle({ color: "purple" });
  expect(body.style.maxHeight).toBe("400px");
  expect(body.style.overflow).toBe("auto");
  expect(body.style.color).toBe("purple");
});
