import { describe, it, expect } from "vitest";
import { parseMarkdownIntoBlocks } from "../src/utils/parse-blocks";

describe("parseMarkdownIntoBlocks", () => {
  it("returns empty array for empty input", () => {
    expect(parseMarkdownIntoBlocks("")).toEqual([]);
  });

  it("splits paragraphs into blocks", () => {
    const input = "First paragraph\n\nSecond paragraph\n\nThird paragraph";
    const blocks = parseMarkdownIntoBlocks(input);
    expect(blocks).toEqual([
      "First paragraph\n\n",
      "Second paragraph\n\n",
      "Third paragraph",
    ]);
  });

  it("keeps heading and following paragraph as separate blocks", () => {
    const input = "# Title\n\nSome text below.";
    const blocks = parseMarkdownIntoBlocks(input);
    expect(blocks).toEqual(["# Title\n\n", "Some text below."]);
  });

  it("keeps code fences as a single block", () => {
    const input =
      "Before\n\n```javascript\nconst x = 1;\n\nconst y = 2;\n```\n\nAfter";
    const blocks = parseMarkdownIntoBlocks(input);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toBe("Before\n\n");
    expect(blocks[1]).toContain("```javascript");
    expect(blocks[1]).toContain("const y = 2;");
    expect(blocks[1]).toContain("```");
    expect(blocks[2]).toBe("After");
  });

  it("keeps unclosed code fence as a single block", () => {
    const input = "Before\n\n```javascript\nconst x = 1;\n\nstill in code";
    const blocks = parseMarkdownIntoBlocks(input);
    // The code block (unclosed) should be one block
    expect(blocks[blocks.length - 1]).toContain("```javascript");
    expect(blocks[blocks.length - 1]).toContain("still in code");
  });

  it("handles tilde code fences", () => {
    const input = "~~~\ncode here\n~~~";
    const blocks = parseMarkdownIntoBlocks(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("~~~");
  });

  it("handles list items as contiguous block", () => {
    const input = "- Item 1\n- Item 2\n- Item 3";
    const blocks = parseMarkdownIntoBlocks(input);
    expect(blocks).toHaveLength(1);
  });

  it("handles multiple blank lines", () => {
    const input = "First\n\n\n\nSecond";
    const blocks = parseMarkdownIntoBlocks(input);
    expect(blocks).toEqual(["First\n\n\n\n", "Second"]);
  });
});
