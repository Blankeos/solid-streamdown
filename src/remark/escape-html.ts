/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Ported from Streamdown 2.7.0 (https://github.com/vercel/streamdown).
 */
import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// Convert HTML nodes to text when rehype-raw is not present
// This allows HTML to be displayed as escaped text instead of being stripped
export const remarkEscapeHtml: Plugin<[], Root> = () => (tree) => {
  visit(tree, "html", (node, index, parent) => {
    /* v8 ignore next */
    if (!parent || typeof index !== "number") {
      return;
    }

    // Convert HTML node to text node - the renderer will handle escaping
    parent.children[index] = {
      type: "text",
      value: node.value,
    };
  });
};
