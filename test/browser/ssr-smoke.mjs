import assert from "node:assert/strict";
import { renderToString } from "solid-js/web";
import { Streamdown } from "solid-streamdown";
import { code } from "solid-streamdown/code";
import { math } from "solid-streamdown/math";
import { cjk } from "solid-streamdown/cjk";
import { mermaid } from "solid-streamdown/mermaid";
const html = renderToString(() =>
  Streamdown({
    children:
      "**中文。**测试\n\n$$\nx^2\n$$\n\n```mermaid\ngraph TD; A-->B\n```",
    plugins: { code, math, cjk, mermaid },
  }),
);
const { JSDOM } = await import("jsdom");
const document = new JSDOM(html).window.document;
assert.equal(document.querySelector("strong")?.textContent, "中文。");
assert.ok(document.querySelector(".katex math"));
assert.match(
  document.querySelector("[data-streamdown=mermaid]").textContent,
  /graph TD/,
);
assert.equal(document.querySelector("[data-streamdown=mermaid] svg"), null);
console.log("Built package SSR math/CJK and Mermaid fallback passed");
