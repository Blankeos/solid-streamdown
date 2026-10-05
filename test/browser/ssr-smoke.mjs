import assert from "node:assert/strict";
import { renderToString } from "solid-js/web";
import { Streamdown } from "@blankeos/solid-streamdown";
import { code } from "@blankeos/solid-streamdown/code";
import { math } from "@blankeos/solid-streamdown/math";
import { cjk } from "@blankeos/solid-streamdown/cjk";
import { mermaid } from "@blankeos/solid-streamdown/mermaid";
const html = renderToString(() =>
  Streamdown({
    children:
      "**中文。**测试\n\n$$\nx^2\n$$\n\n```mermaid\ngraph TD; A-->B\n```",
    plugins: { code, math, cjk, mermaid },
  }),
);
const { JSDOM } = await import("jsdom");
const document = new JSDOM(html).window.document;
assert.equal(
  document.querySelector("span[data-streamdown=strong]")?.textContent,
  "中文。",
);
assert.ok(document.querySelector(".katex math"));
assert.match(
  document.querySelector("[data-streamdown=mermaid]").textContent,
  /graph TD/,
);
assert.equal(
  document.querySelector("[data-streamdown=mermaid] svg:has(text)"),
  null,
);
console.log("Built package SSR math/CJK and Mermaid fallback passed");
const controlsHtml = renderToString(() =>
  Streamdown({
    children:
      "```js\nconst value = 1;\n```\n\n| A | B |\n| --- | --- |\n| x | y |\n\n**hidden** [link](https://example.org)",
    controls: { code: { download: { filename: "source" } }, table: true },
    disallowedElements: ["strong"],
    linkSafety: { enabled: false },
    urlTransform: (url, key, node) => (node.tagName === "a" ? "/safe" : url),
  }),
);
const controlsDocument = new JSDOM(controlsHtml).window.document;
assert.ok(
  controlsDocument.querySelector("[data-streamdown=code-block-copy-button]"),
);
assert.ok(controlsDocument.querySelector('button[aria-label="Copy table"]'));
assert.equal(controlsDocument.querySelector("strong"), null);
assert.equal(
  controlsDocument.querySelector("a")?.getAttribute("href"),
  "/safe",
);
console.log(
  "Built package SSR controls and filtering passed without browser globals",
);
