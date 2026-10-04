import { onCleanup, For, Index, Show } from "solid-js";
import { DefaultChatTransport } from "ai";
import { render } from "solid-js/web";
import { useChat } from "ai-sdk-solid";
import { Streamdown } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { mermaid } from "solid-streamdown/mermaid";
import { math } from "solid-streamdown/math";
import { cjk } from "solid-streamdown/cjk";
import "katex/dist/katex.min.css";
import "solid-streamdown/styles.css";

export function mountChatExample() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  return render(Chat, root);
}

function Chat() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const emit = (chunk: object) =>
    controller!.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`),
    );
  const { messages, status, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(stream) {
              controller = stream;
              emit({ type: "start", messageId: "response" });
              emit({ type: "text-start", id: "text" });
              emit({ type: "text-delta", id: "text", delta: "Hello" });
            },
          }),
          {
            headers: {
              "content-type": "text/event-stream",
              "x-vercel-ai-ui-message-stream": "v1",
            },
          },
        ),
    }),
  });
  onCleanup(() => {
    void stop();
  });

  return (
    <div>
      <button onClick={() => void sendMessage({ text: "Hi" })}>Send</button>
      <button
        onClick={() =>
          emit({ type: "text-delta", id: "text", delta: " world" })
        }
      >
        Append
      </button>
      <button
        onClick={() => {
          emit({ type: "text-end", id: "text" });
          emit({ type: "finish" });
          controller!.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller!.close();
        }}
      >
        Finish
      </button>
      <output>{status()}</output>
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
