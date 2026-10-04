import { afterEach, describe, it, expect, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal, type JSX } from "solid-js";
import { FeatureContext } from "../src/feature-block";
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
} from "../src/code-block";
import { Table, TableCopyDropdown, TableDownloadButton } from "../src/table";
import { Overlay } from "../src/portal";
import { LinkComponent } from "../src/link";
import { Streamdown } from "../src/stream-markdown";
let disposers: (() => void)[] = [];
function mount(ui: () => JSX.Element) {
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(ui, root);
  disposers.push(() => {
    dispose();
    root.remove();
  });
  return root;
}
afterEach(() => {
  disposers.splice(0).forEach((f) => f());
  vi.restoreAllMocks();
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
describe("native public controls", () => {
  it("copies raw context code including trailing newlines and honors standalone download extension", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const blobs: Blob[] = [];
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn((blob: Blob) => {
          blobs.push(blob);
          return "blob:test";
        }),
        revokeObjectURL: vi.fn(),
      }),
    );
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function () {
        downloads.push(this.download);
      },
    );
    const root = mount(() => (
      <CodeBlock code={"const x=1;\n\n"} language="typescript">
        <CodeBlockCopyButton />
        <CodeBlockDownloadButton language="typescript" />
      </CodeBlock>
    ));
    root
      .querySelector<HTMLButtonElement>(
        '[data-streamdown="code-block-copy-button"]',
      )!
      .click();
    await tick();
    expect(writeText).toHaveBeenCalledWith("const x=1;\n\n");
    expect(root.querySelector("output")?.textContent).toBe("Copied");
    root
      .querySelector<HTMLButtonElement>(
        '[data-streamdown="code-block-download-button"]',
      )!
      .click();
    expect(downloads).toEqual(["file.ts"]);
    expect(blobs[0].type).toBe("text/plain");
  });
  it("exports the live DOM table with rich clipboard and TSV newline escaping", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    });
    class Clipboard {
      constructor(public data: Record<string, Blob>) {}
    }
    vi.stubGlobal("ClipboardItem", Clipboard);
    const root = mount(() => (
      <Table showControls showDownload={false} showFullscreen={false}>
        <thead>
          <tr>
            <th>Header</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              changed
              <br />
              value
            </td>
          </tr>
        </tbody>
      </Table>
    ));
    root.querySelector<HTMLButtonElement>('[title="Copy table"]')!.click();
    root
      .querySelector<HTMLButtonElement>('[title="Copy table as TSV"]')!
      .click();
    await tick();
    const item = write.mock.calls[0][0][0] as Clipboard;
    expect(Object.keys(item.data)).toEqual(["text/plain", "text/html"]);
    expect(await item.data["text/plain"].text()).toBe(
      "Header\nchanged\\nvalue",
    );
    expect(await item.data["text/html"].text()).toContain("<br>");
  });
  it("locks nested overlays, closes only topmost on Escape and restores focus and portal target reactively", async () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const a = document.createElement("div"),
      b = document.createElement("div");
    document.body.append(a, b);
    const [one, setOne] = createSignal(true),
      [two, setTwo] = createSignal(true),
      [target, setTarget] = createSignal<HTMLElement>(a);
    mount(() => (
      <>
        <Overlay
          open={one()}
          onClose={() => setOne(false)}
          target={() => target()}
          label="one"
        >
          <button>one</button>
        </Overlay>
        <Overlay open={two()} onClose={() => setTwo(false)} label="two">
          <button>two</button>
        </Overlay>
      </>
    ));
    await tick();
    expect(document.body.style.overflow).toBe("hidden");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await tick();
    expect(two()).toBe(false);
    expect(one()).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    setTarget(b);
    await tick();
    expect(b.querySelector('[role="dialog"]')).not.toBeNull();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await tick();
    expect(one()).toBe(false);
    expect(document.body.style.overflow).not.toBe("hidden");
    button.remove();
    a.remove();
    b.remove();
  });
  it("ignores stale link checks and permits trusted plugin binding only after SVG sanitization", async () => {
    let resolve!: (allowed: boolean) => void;
    const check = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    const [url, setUrl] = createSignal("https://first.example");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const root = mount(() => (
      <FeatureContext.Provider
        value={{ linkSafety: { enabled: true, onLinkCheck: check } }}
      >
        <LinkComponent href={url()}>link</LinkComponent>
      </FeatureContext.Provider>
    ));
    root.querySelector("button")!.click();
    setUrl("https://second.example");
    resolve(true);
    await tick();
    expect(open).not.toHaveBeenCalled();
    let bound: Element | undefined;
    mount(() => (
      <Streamdown
        mode="static"
        controls={false}
        plugins={{
          mermaid: {
            name: "mermaid",
            type: "diagram",
            language: "mermaid",
            getMermaid: () => ({
              render: async () => ({
                svg: '<svg><script>alert(1)</script><text onclick="bad()">safe</text></svg>',
                bindFunctions: (el: Element) => {
                  bound = el;
                },
              }),
            }),
          },
        }}
      >
        {"```mermaid\ngraph TD\n A-->B\n```"}
      </Streamdown>
    ));
    await tick();
    await tick();
    expect(bound?.querySelector("svg")).not.toBeNull();
    expect(bound?.querySelector("script")).toBeNull();
    expect(bound?.querySelector("[onclick]")).toBeNull();
  });
});

it("CSV download paths emit Excel UTF-8 BOM bytes, never clipboard or non-CSV saves", async () => {
  const blobs: Blob[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return "blob:test";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const root = mount(() => (
    <Table showControls showFullscreen={false}>
      <thead>
        <tr>
          <th>Héader</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>中文</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td>
            <TableDownloadButton />
          </td>
        </tr>
      </tfoot>
    </Table>
  ));
  root
    .querySelector<HTMLButtonElement>('[title="Download table as CSV"]')!
    .click();
  root.querySelector<HTMLButtonElement>('[title="Download table"]')!.click();
  root
    .querySelector<HTMLButtonElement>(
      '[title="Download table as CSV"][role="menuitem"]',
    )!
    .click();
  for (const blob of blobs)
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([
      239, 187, 191,
    ]);
  expect(blobs).toHaveLength(2);
  root.querySelector<HTMLButtonElement>('[title="Copy table"]')!.click();
  root.querySelector<HTMLButtonElement>('[title="Copy table as CSV"]')!.click();
  await tick();
  expect(writeText.mock.calls[0][0].startsWith("Héader")).toBe(true);
  root.querySelector<HTMLButtonElement>('[title="Download table"]')!.click();
  root
    .querySelector<HTMLButtonElement>('[title="Download table as Markdown"]')!
    .click();
  expect([
    ...new Uint8Array(await blobs[2].arrayBuffer()).slice(0, 3),
  ]).not.toEqual([239, 187, 191]);
});
