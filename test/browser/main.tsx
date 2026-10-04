import { createSignal, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { Streamdown } from "solid-streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import { mermaid } from "@streamdown/mermaid";
import { code as nativeCode } from "solid-streamdown/code";
import { math as nativeMath } from "solid-streamdown/math";
import { cjk as nativeCjk } from "solid-streamdown/cjk";
import { mermaid as nativeMermaid } from "solid-streamdown/mermaid";
import "../../styles.css";
import "katex/dist/katex.min.css";
import "./reveal.css";

import { longGuide } from "./long-guide";

const initial =
  "**中文。**测试\n\n$$\nx^2\n$$\n\n```js\nconst answer = 42;\n```\n\n```mermaid\ngraph TD\n A[Alpha] --> B[Beta]\n```";
const report =
  "Report **paid *on `2026-10-04`***: $1,234.56.\n\n" +
  "| Date | Amount | Status |\n| :--- | ---: | :---: |\n" +
  "| 2026-10-04 | $1,234.56 | **paid *in `USD`*** |\n" +
  "| 2026-10-05 | $78.90 | pending |\n\n" +
  "Final **total**: `$1,313.46`.\n\n```text\n2026-10-04 $1,234.56\n```";

function Reveal() {
  const [text, setText] = createSignal("");
  const [animating, setAnimating] = createSignal(true);
  const [appending, setAppending] = createSignal(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(timer));
  const start = () => {
    clearInterval(timer);
    setAnimating(true);
    setText("Report ");
    setAppending(true);
    const long = new URLSearchParams(location.search).has("long");
    const transcript = long ? longGuide : report;
    let end = long ? 0 : 7;
    if (long) setText("");
    let tick = 0;
    timer = setInterval(
      () => {
        end = Math.min(
          end + (long ? 3 + ((tick++ * 7) % 18) : 14),
          transcript.length,
        );
        setText(transcript.slice(0, end));
        if (end === transcript.length) {
          clearInterval(timer);
          setAppending(false);
        }
      },
      new URLSearchParams(location.search).has("long") ? 15 : 25,
    );
  };
  return (
    <>
      <button onClick={start}>Start stream</button>
      <button onClick={() => setAnimating(false)}>Complete</button>
      <div data-appending={appending()} data-animating={animating()}>
        <Streamdown
          class="reveal"
          children={text()}
          plugins={{ cjk: nativeCjk }}
          isAnimating={animating()}
          animated={{
            animation: "customReveal",
            duration: 450,
            easing: "ease-out",
            sep: "char",
            stagger: 8,
            maxBacklogMs: 320,
          }}
        />
      </div>
    </>
  );
}
function Plugins() {
  const [text, setText] = createSignal(initial);
  const plugins =
    new URLSearchParams(location.search).get("plugins") === "native"
      ? {
          code: nativeCode,
          math: nativeMath,
          cjk: nativeCjk,
          mermaid: nativeMermaid,
        }
      : { code, math, cjk, mermaid };
  return (
    <>
      <button onClick={() => setText(initial.replace("Alpha", "Updated"))}>
        Update
      </button>
      <Streamdown plugins={plugins}>{text()}</Streamdown>
    </>
  );
}
function Controls() {
  const [lines, setLines] = createSignal(1);
  const [active, setActive] = createSignal(false);
  const [controls, setControls] = createSignal(true);
  return (
    <>
      <button onClick={() => setLines((value) => value + 20)}>
        Append lines
      </button>
      <button onClick={() => setActive((value) => !value)}>
        Toggle streaming
      </button>
      <button onClick={() => setControls((value) => !value)}>
        Toggle controls
      </button>
      <Streamdown
        controls={controls()}
        isAnimating={active()}
        codeBlockMaxHeight={60}
        tableMaxHeight={60}
        translations={{ copyCode: "Copy source" }}
        icons={{ CopyIcon: () => <span data-custom-icon="true">C</span> }}
        urlTransform={(url, key, node) =>
          node.tagName === "a" ? `/proxy?url=${encodeURIComponent(url)}` : url
        }
        disallowedElements={["strong"]}
        unwrapDisallowed
      >
        {"```js\n" +
          Array.from({ length: lines() }, (_, index) =>
            index === 0 ? "const answer = 42;" : `// line ${index}`,
          ).join("\n") +
          "\n```\n\n| Name | Value |\n| --- | --- |\n| alpha | a,b |\n\n**Filtered** [Link](https://example.org)"}
      </Streamdown>
    </>
  );
}
render(
  () =>
    new URLSearchParams(location.search).has("controls") ? (
      <Controls />
    ) : new URLSearchParams(location.search).has("reveal") ? (
      <Reveal />
    ) : (
      <Plugins />
    ),
  document.getElementById("app")!,
);
