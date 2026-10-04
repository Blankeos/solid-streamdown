/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Ported from Streamdown 2.7.0 (https://github.com/vercel/streamdown).
 */
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { harden } from "rehype-harden";
import remarkGfm from "remark-gfm";
import type { Pluggable, PluggableList } from "unified";
import { remarkCodeMeta } from "./remark/code-meta";

export const defaultSanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "tel", "streamdown"],
    src: [...(defaultSchema.protocols?.src ?? []), "streamdown"],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "metastring"],
  },
};
export const defaultRehypePlugins: Record<string, Pluggable> = {
  raw: rehypeRaw,
  sanitize: [rehypeSanitize, defaultSanitizeSchema],
  harden: [
    harden,
    {
      allowedImagePrefixes: ["*"],
      allowedLinkPrefixes: ["*"],
      allowedProtocols: ["*"],
      defaultOrigin: undefined,
      allowDataImages: true,
    },
  ],
};
export const defaultRemarkPlugins: Record<string, Pluggable> = {
  gfm: [remarkGfm, {}],
  codeMeta: remarkCodeMeta,
};
export const defaultRehypePluginsArray = Object.values(defaultRehypePlugins);
export const defaultRemarkPluginsArray = Object.values(defaultRemarkPlugins);

/**
 * Custom plugin lists replace defaults, just as in Streamdown. These are trusted
 * application configuration: an empty/custom list opts out of sanitization and
 * hardening. allowedTags augments only the default schema, never a custom list.
 * Attribute names follow HAST's canonical property names (e.g. dataId).
 */
export function resolveRehypePlugins(
  plugins: PluggableList | undefined,
  allowedTags?: Record<string, string[]>,
): PluggableList {
  if (
    (plugins === undefined || plugins === defaultRehypePluginsArray) &&
    allowedTags &&
    Object.keys(allowedTags).length
  ) {
    return [
      defaultRehypePlugins.raw,
      [
        rehypeSanitize,
        {
          ...defaultSanitizeSchema,
          tagNames: [
            ...(defaultSanitizeSchema.tagNames ?? []),
            ...Object.keys(allowedTags),
          ],
          attributes: { ...defaultSanitizeSchema.attributes, ...allowedTags },
        },
      ],
      defaultRehypePlugins.harden,
    ];
  }
  return plugins ?? defaultRehypePluginsArray;
}
