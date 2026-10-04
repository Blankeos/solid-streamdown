/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Ported from Streamdown 2.7.0 (https://github.com/vercel/streamdown).
 */
import remend, { type RemendOptions } from "remend";
import { preprocessCustomTags } from "./preprocess-custom-tags";
import { preprocessLiteralTagContent } from "./preprocess-literal-tag-content";

const HTML_BLOCK_START_PATTERN = /^[ \t]*<[\w!/?-]/;
const HTML_LINE_INDENT_PATTERN = /(^|\n)[ \t]{4,}(?=<[\w!/?-])/g;
export const normalizeHtmlIndentation = (content: string): string => {
  if (
    typeof content !== "string" ||
    !content.length ||
    !HTML_BLOCK_START_PATTERN.test(content)
  )
    return content;
  return content.replace(HTML_LINE_INDENT_PATTERN, "$1");
};

/** Transform prose without rewriting fenced code examples. */
function outsideFences(
  content: string,
  transform: (value: string) => string,
): string {
  const lines = content.split(/(?<=\n)/);
  let fence: { char: string; length: number } | undefined;
  let prose = "";
  let result = "";
  for (const line of lines) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(line);
    if (!fence && match && !(match[1][0] === "`" && match[2].includes("`"))) {
      result += transform(prose);
      prose = "";
      fence = { char: match[1][0], length: match[1].length };
      result += line;
    } else if (fence) {
      result += line;
      if (
        match &&
        match[1][0] === fence.char &&
        match[1].length >= fence.length &&
        !match[2].trim()
      )
        fence = undefined;
    } else prose += line;
  }
  return result + transform(prose);
}

export interface PreprocessOptions {
  isStreaming?: boolean;
  remend?: RemendOptions;
  allowedTags?: Record<string, string[]>;
  literalTagContent?: string[];
  normalizeHtmlIndentation?: boolean;
}
/** Whole-document preparation. Core block rendering must set skipPreprocessing after calling this. */
export function prepareMarkdown(
  content: string,
  options: PreprocessOptions = {},
): string {
  const repaired = options.isStreaming
    ? remend(content, options.remend)
    : content;
  return outsideFences(repaired, (prose) => {
    let result = options.literalTagContent?.length
      ? preprocessLiteralTagContent(prose, options.literalTagContent)
      : prose;
    if (options.allowedTags)
      result = preprocessCustomTags(result, Object.keys(options.allowedTags));
    return options.normalizeHtmlIndentation
      ? normalizeHtmlIndentation(result)
      : result;
  });
}
