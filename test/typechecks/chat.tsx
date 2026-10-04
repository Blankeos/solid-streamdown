import { For, Index, Show } from "solid-js";
import { useChat } from "ai-sdk-solid";
import { Streamdown } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { mermaid } from "solid-streamdown/mermaid";
import { math } from "solid-streamdown/math";
import { cjk } from "solid-streamdown/cjk";
import "katex/dist/katex.min.css";
import "solid-streamdown/styles.css";

export default function Chat() {
  const { messages, status } = useChat();

  return (
    <div>
      <For each={messages}>
        {(message) => (
          <div>
            {message.role === "user" ? "User: " : "AI: "}
            <Index each={message.parts}>
              {(part) => {
                const textPart = () => {
                  const value = part();
                  return value.type === "text" ? value.text : undefined;
                };
                return (
                  <Show when={part().type === "text"}>
                    <Streamdown
                      animated
                      plugins={{ code, mermaid, math, cjk }}
                      isAnimating={status() === "streaming"}
                    >
                      {textPart()}
                    </Streamdown>
                  </Show>
                );
              }}
            </Index>
          </div>
        )}
      </For>
    </div>
  );
}
