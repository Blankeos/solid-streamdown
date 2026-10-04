import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { Streamdown } from "../../src/stream-markdown";
/** Mount from main.tsx when ?ui-parity is present. */
export function UiParity() {
  const [animating, setAnimating] = createSignal(false);
  return (
    <>
      <button onClick={() => setAnimating((v) => !v)}>Toggle stream</button>
      <Streamdown
        isAnimating={animating()}
        plugins={{
          mermaid: {
            name: "mermaid",
            type: "diagram",
            language: "mermaid",
            getMermaid: () => ({
              render: async () => ({
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80"><rect width="100" height="80" fill="orange"/><text x="10" y="30">Diagram</text></svg>',
              }),
            }),
          },
        }}
        linkSafety={{ enabled: true }}
      >
        {
          "```typescript\nconst raw = 1;\n```\n\n| Name | Value |\n| --- | --- |\n| A | 1 |\n\n```mermaid\ngraph TD\n A-->B\n```\n\n[external](https://example.com)"
        }
      </Streamdown>
    </>
  );
}

export function mountUiParity() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  return render(() => <UiParity />, root);
}
