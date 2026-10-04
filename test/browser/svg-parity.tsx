import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import type { Root } from "hast";
import { Streamdown } from "../../src/stream-markdown";

export function mountSvgParity() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  const [width, setWidth] = createSignal(2);
  const plugin = () => (tree: Root) => {
    tree.children = [
      {
        type: "element",
        tagName: "svg",
        properties: { viewBox: "0 0 100 100", width: 100, height: 100 },
        children: [
          {
            type: "element",
            tagName: "path",
            properties: {
              stroke: "red",
              strokeWidth: width(),
              strokeLineCap: "round",
              fillRule: "evenodd",
              d: "M10 10L90 90",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "a",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "title",
                properties: {},
                children: [{ type: "text", value: "SVG title" }],
              },
            ],
          },
          {
            type: "element",
            tagName: "foreignobject",
            properties: { width: 100, height: 100 },
            children: [
              {
                type: "element",
                tagName: "h1",
                properties: {},
                children: [{ type: "text", value: "HTML" }],
              },
              {
                type: "element",
                tagName: "svg",
                properties: {},
                children: [
                  {
                    type: "element",
                    tagName: "circle",
                    properties: { r: 2 },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
  };
  return render(
    () => (
      <>
        <button onClick={() => setWidth(7)}>revise</button>
        <Streamdown
          rehypePlugins={[plugin]}
        >{`revision ${width()}`}</Streamdown>
      </>
    ),
    root,
  );
}
