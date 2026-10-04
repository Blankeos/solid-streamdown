/**
 * Adapted from Vercel Streamdown 2.7.0.
 * Copyright 2023 Vercel, Inc.
 * Licensed under Apache-2.0; see LICENSE-STREAMDOWN and ATTRIBUTION.md.
 */

import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import { Portal, isServer } from "solid-js/web";
import { useFeatures, useTranslation, UiIcon } from "./ui-utils";
export type PortalTarget = HTMLElement | null | (() => HTMLElement | null);
export function resolvePortalTarget(target?: PortalTarget) {
  return isServer
    ? undefined
    : ((typeof target === "function" ? target() : target) ?? document.body);
}
let locks = 0,
  overflow = "";
const stack: HTMLElement[] = [];
export function Overlay(p: {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  label?: string;
  target?: PortalTarget;
  kind?: string;
}) {
  const c = useFeatures(),
    t = useTranslation();
  const [node, setNode] = createSignal<HTMLElement>();
  createEffect(() => {
    const el = node();
    if (!p.open || !el || isServer) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(el);
    if (locks++ === 0) {
      overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const focusable = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((x) => !x.hidden);
    queueMicrotask(() => {
      if (stack.includes(el)) (focusable()[0] ?? el).focus();
    });
    const key = (e: KeyboardEvent) => {
      if (stack.at(-1) !== el) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        p.onClose();
      }
      if (e.key === "Tab") {
        const f = focusable(),
          first = f[0] ?? el,
          last = f.at(-1) ?? el;
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !el.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    onCleanup(() => {
      document.removeEventListener("keydown", key, true);
      const index = stack.indexOf(el);
      const wasTop = index === stack.length - 1;
      if (index !== -1) stack.splice(index, 1);
      if (--locks === 0) document.body.style.overflow = overflow;
      if (wasTop && previous?.isConnected) previous.focus();
    });
  });
  return (
    <Show when={p.open && !isServer}>
      <Portal mount={resolvePortalTarget(p.target ?? c.portal)}>
        <div
          ref={setNode}
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          aria-label={p.label ?? t("viewFullscreen")}
          class={`sd-overlay ${p.kind === "link-safety-modal" ? "sd-link-backdrop" : ""}`}
          data-streamdown={p.kind}
          onClick={(e) => {
            if (e.target === e.currentTarget) p.onClose();
          }}
        >
          <button
            class="sd-overlay-close"
            type="button"
            title={t("exitFullscreen")}
            aria-label={t("close")}
            onClick={p.onClose}
          >
            <UiIcon name="XIcon" size={20} />
          </button>
          {p.children}
        </div>
      </Portal>
    </Show>
  );
}
