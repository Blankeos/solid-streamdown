import { describe, expect, it } from "vitest";
import { createCodePlugin } from "../src/plugins/code";
import { createMathPlugin } from "../src/plugins/math";
import { createCjkPlugin } from "../src/plugins/cjk";
import { createCodePlugin as upstreamCode } from "@streamdown/code";
import { createMathPlugin as upstreamMath } from "@streamdown/math";
import { createCjkPlugin as upstreamCjk } from "@streamdown/cjk";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { CodeHighlighterPlugin } from "../src/plugin-types";

function highlight(
  plugin: CodeHighlighterPlugin,
  code: string,
  language: string,
  isIncomplete = false,
) {
  return new Promise<import("../src/plugin-types").HighlightResult>(
    (resolve) => {
      const result = plugin.highlight(
        {
          code,
          language: language as never,
          themes: plugin.getThemes(),
          isIncomplete,
        },
        resolve,
      );
      if (result) resolve(result);
    },
  );
}
describe("pinned provider contracts", () => {
  it("matches upstream math parsing defaults and explicit options", () => {
    for (const options of [
      {},
      { singleDollarTextMath: true, errorColor: "red" },
    ]) {
      const native = createMathPlugin(options),
        reference = upstreamMath(options);
      expect((native.remarkPlugin as any[])[1]).toEqual(
        (reference.remarkPlugin as any[])[1],
      );
      expect((native.rehypePlugin as any[])[1]).toEqual(
        (reference.rehypePlugin as any[])[1],
      );
      expect(native.getStyles?.()).toBe(reference.getStyles?.());
    }
    expect(
      (createMathPlugin().remarkPlugin as any[])[1].singleDollarTextMath,
    ).toBe(false);
  });
  it("retains CJK pipeline ordering and backwards-compatible combined plugins", () => {
    const native = createCjkPlugin(),
      reference = upstreamCjk();
    const parse = (plugin: typeof native) => {
      const processor = unified()
        .use(remarkParse)
        .use(plugin.remarkPluginsBefore)
        .use(remarkGfm)
        .use(plugin.remarkPluginsAfter);
      return JSON.parse(
        JSON.stringify(
          processor.runSync(
            processor.parse("你好**粗体** https://example.com。 ~~删除~~"),
          ),
        ),
      );
    };
    expect(parse(native)).toEqual(parse(reference));
  });
  it("matches upstream tokens for unknown/truncated languages and streaming multiline rewrites, then serves completed cache synchronously", async () => {
    const native = createCodePlugin(),
      reference = upstreamCode();
    expect(native.getThemes()).toEqual(reference.getThemes());
    for (const [language, source, incomplete] of [
      ["typescr", "const x = 1;", true],
      ["unknown-language", "one\n\nthree\n", false],
      ["typescript", "/* open\ncomment", true],
      ["typescript", "/* open\ncomment */\nconst x = 1;", true],
      ["typescript", "/* replaced */\nconst x = 2;", false],
    ] as const) {
      const result = await highlight(native, source, language, incomplete);
      const expected = await highlight(reference, source, language, incomplete);
      expect(result.tokens).toEqual(expected.tokens);
      expect(result.rootStyle).toEqual(expected.rootStyle);
      if (!incomplete)
        expect(
          native.highlight({
            code: source,
            language: language as never,
            themes: native.getThemes(),
          }),
        ).toEqual(result);
    }
  });
});
