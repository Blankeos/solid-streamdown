import { createSignal, For } from "solid-js";
import { Streamdown } from "@blankeos/solid-streamdown";

export const whitespaceCases = [
  {
    id: "account",
    source: "Which account did you pay with?\nAnswer: GCash",
    text: "Which account did you pay with?\nAnswer: GCash",
  },
  {
    id: "soft-newlines",
    source: "First line\nsecond line\nthird line",
    text: "First line\nsecond line\nthird line",
  },
  {
    id: "emphasis-boundaries",
    source: "Before **bold** after *italic* end",
    text: "Before bold after italic end",
  },
  {
    id: "repeated-edge-spaces",
    // Raw inline HTML keeps edge whitespace in the parsed paragraph; ordinary
    // Markdown indentation/trailing spaces have their own syntax semantics.
    source: "<span>  leading   middle   trailing  </span>",
    text: "  leading   middle   trailing  ",
  },
  {
    id: "nbsp",
    source: "one\u00a0two",
    text: "one\u00a0two",
  },
  {
    id: "inline-code",
    source: "Before `one two` after",
    text: "Before one two after",
  },
  {
    id: "pre-wrap-code",
    // Code-span Markdown normalizes whitespace; raw code preserves the input.
    source: "<code>one   two</code>",
    text: "one   two",
  },
  {
    id: "underlined-link",
    source: "[one two three](https://example.org)",
    text: "one two three",
  },
  {
    id: "midword-control",
    source: "supercalifragilisticexpialidocious",
    text: "supercalifragilisticexpialidocious",
  },
] as const;

export function Whitespace() {
  const params = new URLSearchParams(location.search);
  const sep = params.get("sep") === "word" ? "word" : "char";
  const [animating, setAnimating] = createSignal(true);
  const [appended, setAppended] = createSignal(false);
  const inline = params.has("inline");
  const timing = params.has("timing");
  const width = params.get("width") === "narrow" ? 120 : 800;
  return (
    <main>
      <style>{`
        .whitespace-case { margin: 24px 0; }
        .whitespace-render { width: ${width}px; font: 16px/24px Arial, sans-serif; white-space: normal; font-kerning: ${inline ? "auto" : "none"}; }
        .whitespace-render p { margin: 0; }
        .whitespace-render a { text-decoration: underline; }
        [data-case="pre-wrap-code"] code { white-space: pre-wrap; }
        ${inline ? ".whitespace-render [data-sd-animate] { display: inline; white-space: normal; }" : ""}
      `}</style>
      {/* Atomic inline-block transform hosts chosen by the consumer cannot kern
          across token boundaries. Disable kerning on BOTH roots to isolate the
          whitespace contract from that shaping tradeoff; inline fade hosts keep
          native shaping and are compared with kerning enabled separately. */}
      <button onClick={() => setAnimating(false)}>Settle stream</button>
      <button onClick={() => setAppended(true)}>Append stream</button>
      <h1>
        Whitespace: {sep}, {width}px
      </h1>
      <p>
        Animated wrappers remain mounted after their reveal finishes. Reference
        uses native, unanimated Streamdown.
      </p>
      <For each={whitespaceCases}>
        {(sample) => (
          <section class="whitespace-case" data-case={sample.id}>
            <h2>{sample.id}</h2>
            <pre>{JSON.stringify(sample.source)}</pre>
            <div data-render="animated" class="whitespace-render">
              <Streamdown
                components={{ a: "a" }}
                isAnimating={animating()}
                animated={{
                  animation: inline ? "fadeIn" : "customReveal",
                  duration: timing ? 1000 : 40,
                  stagger: timing ? 250 : 0,
                  maxBacklogMs: timing ? 2000 : 320,
                  sep,
                }}
              >
                {sample.id === "account" && appended()
                  ? `${sample.source} today`
                  : sample.source}
              </Streamdown>
            </div>
            <div data-render="settled" class="whitespace-render">
              <Streamdown components={{ a: "a" }} isAnimating={false}>
                {sample.id === "account" && appended()
                  ? `${sample.source} today`
                  : sample.source}
              </Streamdown>
            </div>
          </section>
        )}
      </For>
    </main>
  );
}
