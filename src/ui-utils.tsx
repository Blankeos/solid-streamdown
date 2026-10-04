/**
 * Adapted from Vercel Streamdown 2.7.0.
 * Copyright 2023 Vercel, Inc.
 * Licensed under Apache-2.0; see LICENSE-STREAMDOWN and ATTRIBUTION.md.
 */

import { useContext, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { FeatureContext, defaultStreamdownContext } from "./streamdown-context";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  defaultIcons,
  defaultTranslations,
  type IconMap,
  type StreamdownTranslations,
} from "./controls";
export function useFeatures() {
  const context = useContext(FeatureContext);
  return new Proxy(context, {
    get(target, key) {
      return (
        Reflect.get(target, key) ?? Reflect.get(defaultStreamdownContext, key)
      );
    },
  });
}
export function useTranslation() {
  const c = useFeatures();
  return (k: keyof StreamdownTranslations) =>
    c.translations?.[k] ?? defaultTranslations[k];
}
export function UiIcon(p: {
  name: keyof IconMap;
  size?: number;
  className?: string;
  class?: string;
}) {
  const c = useFeatures();
  return (
    <Dynamic
      component={c.icons?.[p.name] ?? defaultIcons[p.name]}
      size={p.size ?? 14}
      class={p.className ?? p.class}
    />
  );
}
export function prefixClassNames(className: string, prefix?: string) {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      prefix && !token.startsWith(`${prefix}:`) ? `${prefix}:${token}` : token,
    )
    .join(" ");
}
export function createCn(prefix?: string) {
  return (...classes: ClassValue[]) =>
    prefixClassNames(twMerge(clsx(classes)), prefix);
}
export function useCn() {
  const c = useFeatures();
  return (...classes: ClassValue[]) => createCn(c.prefix)(...classes);
}
export function control(
  kind: "code" | "table" | "mermaid" | "image",
  action: string,
) {
  const c = useFeatures();
  return () => {
    const config = c.controls ?? true;
    if (typeof config === "boolean") return config;
    const sub = config[kind];
    return typeof sub === "boolean"
      ? sub
      : ((sub as Record<string, unknown> | undefined)?.[action] ?? true);
  };
}
export function filename(config: unknown, kind: string, fallback: string) {
  const val = (
    config as
      Record<string, { download?: boolean | { filename?: string } }> | undefined
  )?.[kind]?.download;
  return typeof val === "object" ? val.filename || fallback : fallback;
}
export function save(
  name: string,
  content: Blob | string,
  type = "text/plain",
) {
  if (isServer) return;
  const url = URL.createObjectURL(
    typeof content === "string"
      ? new Blob([type.startsWith("text/csv") ? "\uFEFF" + content : content], {
          type,
        })
      : content,
  );
  const a = document.createElement("a");
  try {
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
  } finally {
    a.remove();
    URL.revokeObjectURL(url);
  }
}
export type HostProps<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T] & { className?: string; node?: unknown };
