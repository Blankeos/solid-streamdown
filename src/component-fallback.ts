/*
 * Copyright Vercel, Inc.
 * Licensed under the Apache License, Version 2.0 (see LICENSE-STREAMDOWN).
 * Ported from Streamdown 2.7.0 (https://github.com/vercel/streamdown).
 */
import type { Component } from "solid-js";
import type { AllowedTags, Components, ExtraProps } from "./types";

/** Apply after merging default and user components; explicit mappings always win. */
export function resolveComponentFallback(
  components: Components = {},
  fallback?: Component<Record<string, unknown> & ExtraProps>,
  allowedTags?: AllowedTags,
): Components {
  if (!fallback) return components;
  const merged = { ...components };
  for (const tag of Object.keys(allowedTags ?? {})) {
    if (!Object.hasOwn(merged, tag)) merged[tag] = fallback;
  }
  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: false,
    value: fallback,
    writable: false,
  };
  return new Proxy(merged, {
    getOwnPropertyDescriptor(target, prop) {
      return (
        Object.getOwnPropertyDescriptor(target, prop) ??
        (typeof prop === "string" && /^[a-z]/.test(prop)
          ? descriptor
          : undefined)
      );
    },
    get(target, prop, receiver) {
      if (
        typeof prop === "string" &&
        /^[a-z]/.test(prop) &&
        !Object.hasOwn(target, prop)
      )
        return fallback;
      return Reflect.get(target, prop, receiver);
    },
  });
}
