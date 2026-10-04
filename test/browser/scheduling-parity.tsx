import { createSignal, For } from "solid-js";
import { render } from "solid-js/web";
import { FeatureContext } from "../../src/feature-block";
import { Table } from "../../src/table";
import { PanZoom } from "../../src/mermaid";
import { Streamdown } from "../../src/stream-markdown";
export function mountSchedulingParity() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  return render(() => {
    const [count, setCount] = createSignal(0);
    const [rows, setRows] = createSignal(2);
    const [streaming, setStreaming] = createSignal(false);
    const [width, setWidth] = createSignal(400);
    const [chart, setChart] = createSignal("first");
    const [calls, setCalls] = createSignal(0);
    return (
      <FeatureContext.Provider
        value={{
          get isAnimating() {
            return streaming();
          },
        }}
      >
        <style>{`[data-fit-fixture] .sd-panzoom-viewport { max-height: none; }`}</style>
        <button onClick={() => setRows((r) => r + 20)}>Append rows</button>
        <button onClick={() => setStreaming((s) => !s)}>
          Toggle streaming
        </button>
        <button onClick={() => setWidth(200)}>Narrow</button>
        <button onClick={() => setChart("latest")}>Update diagram</button>
        <output data-render-count>{calls()}</output>
        <Table showControls maxHeight={100} className="custom-table">
          <tbody>
            <For each={Array.from({ length: rows() }, (_, i) => i)}>
              {(i) => (
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
              )}
            </For>
          </tbody>
        </Table>
        <div
          data-fit-fixture
          style={{ width: `${width()}px`, "max-height": "min(70vh, 10rem)" }}
        >
          <PanZoom
            contentSize={{ width: 800, height: 800 }}
            isAutoFit
            fitKey="fixture"
            minZoom={0.5}
            maxZoom={0.8}
          >
            <svg width="800" height="800">
              <rect width="800" height="800" fill="orange" />
            </svg>
          </PanZoom>
        </div>
        <For each={["global", "panZoom", "enabled"] as const}>
          {(mode) => (
            <div data-mermaid-controls={mode} style={{ width: "400px" }}>
              <Streamdown
                controls={
                  mode === "global"
                    ? false
                    : mode === "panZoom"
                      ? { mermaid: { panZoom: false } }
                      : true
                }
                plugins={{
                  mermaid: {
                    name: "mermaid",
                    type: "diagram",
                    language: "mermaid",
                    getMermaid: () => ({
                      initialize() {},
                      async render() {
                        return {
                          svg: '<svg viewBox="0 0 400 200"><rect width="400" height="200" fill="orange" /></svg>',
                        };
                      },
                    }),
                  },
                }}
              >{`\`\`\`mermaid\ncontrols fixture\n\`\`\``}</Streamdown>
            </div>
          )}
        </For>
        <div style={{ "margin-top": "2000px" }} data-offscreen>
          <Streamdown
            plugins={{
              mermaid: {
                name: "mermaid",
                type: "diagram",
                language: "mermaid",
                getMermaid: () => ({
                  initialize() {},
                  async render(_id, source) {
                    setCalls((c) => c + 1);
                    return {
                      svg: `<svg viewBox="0 0 100 50"><text>${source}</text></svg>`,
                    };
                  },
                }),
              },
            }}
          >{`\`\`\`mermaid\n${chart()}\n\`\`\``}</Streamdown>
        </div>
      </FeatureContext.Provider>
    );
  }, root);
}
