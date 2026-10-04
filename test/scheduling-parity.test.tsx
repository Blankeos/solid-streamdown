import { afterEach, expect, it, vi } from "vitest";
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { FeatureContext, FeatureBlock } from "../src/feature-block";
import { BlockIncompleteContext } from "../src/block-incomplete-context";
import { Table } from "../src/table";
import { BoundSvg } from "../src/mermaid";
import type { Element } from "hast";
const cleanups: (() => void)[] = [];
function mount(ui: () => JSX.Element) {
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(ui, root);
  cleanups.push(() => {
    dispose();
    root.remove();
  });
  return root;
}
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.unstubAllGlobals();
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
function element(code: string): Element {
  return {
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
  };
}
const svg = (code: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><text>${code}</text><script>alert(1)</script></svg>`;
it("serializes layouts, coalesces pending source, preserves last success on failure and invalidates unmount", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const [code, setCode] = createSignal("first");
  const calls: {
    id: string;
    code: string;
    resolve: (v: { svg: string }) => void;
    reject: (e: Error) => void;
  }[] = [];
  const plugin = {
    name: "mermaid" as const,
    type: "diagram" as const,
    language: "mermaid",
    getMermaid: () => ({
      initialize() {},
      render: (id: string, code: string) =>
        new Promise<{ svg: string }>((resolve, reject) =>
          calls.push({ id, code, resolve, reject }),
        ),
    }),
  };
  const root = mount(() => (
    <FeatureContext.Provider value={{ plugins: { mermaid: plugin } }}>
      <FeatureBlock element={() => element(code())} />
    </FeatureContext.Provider>
  ));
  expect(calls.map((c) => c.code)).toEqual(["first"]);
  setCode("skip");
  setCode("latest");
  expect(calls).toHaveLength(1);
  calls[0].resolve({ svg: svg("first") });
  await tick();
  expect(calls.map((c) => c.code)).toEqual(["first", "latest"]);
  expect(root.querySelector("svg")?.textContent).toBe("first");
  expect(root.querySelector("script")).toBeNull();
  calls[1].reject(new Error("incomplete syntax"));
  await tick();
  expect(root.querySelector("svg")?.textContent).toBe("first");
  expect(root.querySelector('[role="alert"]')).toBeNull();
  setCode("final");
  calls[2].resolve({ svg: svg("final") });
  await tick();
  expect(root.querySelector("svg")?.textContent).toBe("final");
  expect(new Set(calls.map((c) => c.id)).size).toBe(3);
  setCode("after dispose");
  cleanups.splice(0).forEach((f) => f());
  calls[3].resolve({ svg: svg("late") });
  await tick();
  expect(document.querySelector("svg")).toBeNull();
});
it("defers offscreen work, cancels a brief intersection and renders latest once visible", async () => {
  vi.useFakeTimers();
  let intersect!: (entries: { isIntersecting: boolean }[]) => void;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: typeof intersect) {
        intersect = cb;
      }
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  const [code, setCode] = createSignal("offscreen");
  const renderChart = vi.fn(async (_id: string, code: string) => ({
    svg: svg(code),
  }));
  mount(() => (
    <FeatureContext.Provider
      value={{
        plugins: {
          mermaid: {
            name: "mermaid",
            type: "diagram",
            language: "mermaid",
            getMermaid: () => ({ initialize() {}, render: renderChart }),
          },
        },
      }}
    >
      <FeatureBlock element={() => element(code())} />
    </FeatureContext.Provider>
  ));
  try {
    setCode("latest visible");
    expect(renderChart).not.toHaveBeenCalled();
    intersect([{ isIntersecting: true }]);
    await vi.advanceTimersByTimeAsync(200);
    intersect([{ isIntersecting: false }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(renderChart).not.toHaveBeenCalled();
    intersect([{ isIntersecting: true }]);
    await vi.advanceTimersByTimeAsync(310);
    expect(renderChart).toHaveBeenCalledTimes(1);
    expect(renderChart.mock.calls[0][1]).toBe("latest visible");
  } finally {
    vi.useRealTimers();
  }
});
it("wakes a streaming layout pause on unchanged final fence closure", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.useFakeTimers();
  const [incomplete, setIncomplete] = createSignal(true);
  const [code, setCode] = createSignal("first");
  const calls: { code: string; resolve: (v: { svg: string }) => void }[] = [];
  const root = mount(() => (
    <FeatureContext.Provider
      value={{
        plugins: {
          mermaid: {
            name: "mermaid",
            type: "diagram",
            language: "mermaid",
            getMermaid: () => ({
              initialize() {},
              render: (_id, code) =>
                new Promise((resolve) => calls.push({ code, resolve })),
            }),
          },
        },
      }}
    >
      <BlockIncompleteContext.Provider value={incomplete}>
        <FeatureBlock element={() => element(code())} />
      </BlockIncompleteContext.Provider>
    </FeatureContext.Provider>
  ));
  try {
    setCode("final");
    await vi.advanceTimersByTimeAsync(1000);
    calls[0].resolve({ svg: svg("first") });
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    setIncomplete(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.map((c) => c.code)).toEqual(["first", "final"]);
    calls[1].resolve({ svg: svg("final") });
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector("svg")?.textContent).toBe("final");
  } finally {
    vi.useRealTimers();
  }
});
it("fullscreen moves the live customized table with handlers and streamed rows, then restores it", async () => {
  const [count, setCount] = createSignal(0),
    [rows, setRows] = createSignal(1);
  const root = mount(() => (
    <FeatureContext.Provider value={{}}>
      <Table showControls class="custom-table">
        <tbody>
          {Array.from({ length: rows() }, (_, i) => (
            <tr>
              <td>
                {i === 0 ? (
                  <button onClick={() => setCount((c) => c + 1)}>
                    Count {count()}
                  </button>
                ) : (
                  `row ${i}`
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </FeatureContext.Provider>
  ));
  const table = root.querySelector("table")!;
  root
    .querySelector<HTMLButtonElement>('[aria-label="View fullscreen"]')!
    .click();
  await tick();
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.querySelector("table")).toBe(table);
  dialog.querySelector<HTMLButtonElement>("td button")!.click();
  expect(dialog.textContent).toContain("Count 1");
  setRows(3);
  expect(dialog.querySelectorAll("tr")).toHaveLength(3);
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await tick();
  expect(root.querySelector("table")).toBe(table);
  expect(table.classList.contains("custom-table")).toBe(true);
  table.querySelector<HTMLButtonElement>("td button")!.click();
  expect(table.textContent).toContain("Count 2");
});
it("runs trusted plugin bindings only on sanitized SVG and disposes binding resources on replacement", () => {
  const [content, setContent] = createSignal(svg("first"));
  let bound = 0,
    cleaned = 0;
  mount(() => (
    <BoundSvg
      svg={content()}
      bindFunctions={(el) => {
        expect(el.querySelector("script")).toBeNull();
        bound++;
        return () => {
          cleaned++;
        };
      }}
    />
  ));
  // BoundSvg receives sanitized plugin SVG through FeatureBlock in production.
  expect(bound).toBe(1);
  setContent(svg("second"));
  expect(bound).toBe(2);
  expect(cleaned).toBe(1);
});
