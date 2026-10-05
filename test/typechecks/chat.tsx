import { For, Index, Show } from "solid-js";
import { useChat } from "ai-sdk-solid";
import { Streamdown } from "@blankeos/solid-streamdown";
import { code } from "@blankeos/solid-streamdown/code";
import { mermaid } from "@blankeos/solid-streamdown/mermaid";
import { math } from "@blankeos/solid-streamdown/math";
import { cjk } from "@blankeos/solid-streamdown/cjk";
import "katex/dist/katex.min.css";
import "@blankeos/solid-streamdown/styles.css";

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
