import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  type PluginConfig,
} from "@blankeos/solid-streamdown";
import { code, createCodePlugin } from "@blankeos/solid-streamdown/code";
import { math, createMathPlugin } from "@blankeos/solid-streamdown/math";
import { cjk } from "@blankeos/solid-streamdown/cjk";
import { mermaid } from "@blankeos/solid-streamdown/mermaid";
import { code as upstreamCode } from "@streamdown/code";
import { math as upstreamMath } from "@streamdown/math";
import { cjk as upstreamCjk } from "@streamdown/cjk";
import { mermaid as upstreamMermaid } from "@streamdown/mermaid";
const plugins: PluginConfig[] = [
  { code, math, cjk, mermaid },
  {
    code: upstreamCode,
    math: upstreamMath,
    cjk: upstreamCjk,
    mermaid: upstreamMermaid,
  },
];
void plugins;
void createCodePlugin({ themes: ["github-light", "github-dark"] });
void createMathPlugin({ singleDollarTextMath: false, errorColor: "red" });
const ui = (
  <CodeBlock
    code="const x=1;\n"
    language="typescript"
    startLine={9}
    lineNumbers={false}
    ref={(body: HTMLDivElement) => body.focus()}
    onClick={(event) => event.currentTarget.focus()}
    style={{ overflow: "auto" }}
    aria-label="Code"
  >
    <CodeBlockCopyButton
      code="raw\n"
      timeout={50}
      onCopy={() => {}}
      onError={(error) => console.log(error.message)}
    />
    <CodeBlockDownloadButton
      code="raw\n"
      language="typescript"
      onDownload={() => {}}
      onError={(error) => console.log(error.message)}
    />
  </CodeBlock>
);
void ui;
