import { batch, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Streamdown, StreamMarkdown } from "../../src/stream-markdown";
import "../../styles.css";
import "./reveal.css";

export function mountSessionReveal() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  return render(() => {
    const [text, setText] = createSignal("Repeat prefix");
    const [active, setActive] = createSignal(true);
    const [mode, setMode] = createSignal<"static" | "streaming">("streaming");
    const animated = {
      animation: "customReveal",
      duration: 450,
      easing: "linear",
      stagger: 8,
      sep: "char" as const,
    };
    return (
      <>
        <button onClick={() => setText("Repeat ")}>Backtrack</button>
        <button onClick={() => setText((t) => t + " appended")}>Append</button>
        <button onClick={() => setActive(false)}>Stop</button>
        <button onClick={() => setActive(true)}>Restart</button>
        <button onClick={() => setText("")}>Clear</button>
        <button
          onClick={() =>
            batch(() => {
              setActive(true);
              setText("Repeat prefix");
            })
          }
        >
          Rewrite
        </button>
        <button
          onClick={() =>
            batch(() => {
              setMode("static");
              setText("Repeat prefix");
            })
          }
        >
          Static
        </button>
        <Streamdown
          class="native-session"
          children={text()}
          isAnimating={active()}
          mode={mode()}
          animated={animated}
        />
        <StreamMarkdown
          class="legacy-session"
          content={text()}
          isAnimating={active()}
          mode={mode()}
          animated={animated}
        />
      </>
    );
  }, root);
}
