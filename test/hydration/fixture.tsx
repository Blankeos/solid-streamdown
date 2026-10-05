import { createSignal } from "solid-js";
import { CodeBlock, CodeBlockCopyButton, Streamdown } from "@blankeos/solid-streamdown";
import { code } from "@blankeos/solid-streamdown/code";
export function Fixture() {
  const [active, setActive] = createSignal(true);
  return (
    <main>
      <CodeBlock
        code={"const answer = 42;\n\n"}
        language="typescript"
        startLine={7}
        id="standalone"
        aria-label="Source"
        onClick={() => setActive(false)}
      >
        <CodeBlockCopyButton />
      </CodeBlock>
      <Streamdown
        plugins={{ code }}
        isAnimating={active()}
        caret="block"
        linkSafety={{ enabled: true }}
      >
        {
          "Paragraph with [external](https://example.com).\n\n```typescript\nconst hydrated = true;\n```\n\n![cached](/cached.gif)\n\n![pending]("
        }
      </Streamdown>
    </main>
  );
}
