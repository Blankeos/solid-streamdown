/**
 * Adapted from Vercel Streamdown 2.7.0.
 * Copyright 2023 Vercel, Inc.
 * Licensed under Apache-2.0; see LICENSE-STREAMDOWN and ATTRIBUTION.md.
 */

import {
  Show,
  createSignal,
  createEffect,
  onCleanup,
  splitProps,
  onMount,
} from "solid-js";
import { INCOMPLETE_IMAGE_PLACEHOLDER } from "remend";
import {
  useTranslation,
  useCn,
  UiIcon,
  save,
  type HostProps,
} from "./ui-utils";
export function ImageComponent(
  p: HostProps<"img"> & {
    showControls?: boolean;
    showDownloadControl?: boolean;
  },
) {
  const t = useTranslation(),
    cn = useCn();
  const [local, rest] = splitProps(p, [
    "src",
    "alt",
    "showControls",
    "showDownloadControl",
    "className",
    "class",
    "node",
    "onLoad",
    "onError",
    "ref",
  ]);
  const [loaded, setLoaded] = createSignal(false),
    [error, setError] = createSignal(false);
  let img!: HTMLImageElement, controller: AbortController | undefined;
  onCleanup(() => controller?.abort());
  createEffect(() => {
    p.src;
    setLoaded(false);
    setError(false);
    controller?.abort();
  });
  onMount(() => {
    if (img?.complete) {
      const success = img.naturalWidth > 0;
      setLoaded(success);
      setError(!success);
    }
  });
  const explicit = () => p.width != null || p.height != null;
  const download = async () => {
    const src = p.src;
    if (!src) return;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    try {
      const response = await fetch(src, { signal: request.signal });
      const blob = await response.blob();
      if (request.signal.aborted || src !== p.src) return;
      const original =
        new URL(src, window.location.origin).pathname.split("/").pop() ?? "";
      const ext = original.split(".").pop();
      const name =
        original.includes(".") && ext && ext.length <= 4
          ? original
          : `${(p.alt || original || "image").replace(/\.[^/.]+$/, "")}.${blob.type.includes("jpeg") ? "jpg" : blob.type.includes("svg") ? "svg" : blob.type.includes("gif") ? "gif" : blob.type.includes("webp") ? "webp" : "png"}`;
      save(name, blob, blob.type);
    } catch {
      if (!request.signal.aborted && src === p.src)
        window.open(src, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <Show when={p.src}>
      <div
        class="sd-image"
        data-streamdown="image-wrapper"
        data-incomplete={p.src === INCOMPLETE_IMAGE_PLACEHOLDER || undefined}
      >
        <Show
          when={p.src !== INCOMPLETE_IMAGE_PLACEHOLDER}
          fallback={
            <div
              class="sd-image-placeholder"
              data-streamdown="image-placeholder"
            />
          }
        >
          <img
            {...rest}
            ref={(el) => {
              img = el;
              if (typeof local.ref === "function") local.ref(el);
            }}
            src={p.src}
            alt={p.alt}
            class={cn(local.className, local.class)}
            hidden={error() && !explicit()}
            data-streamdown="image"
            onLoad={(e) => {
              setLoaded(true);
              setError(false);
              if (typeof local.onLoad === "function") local.onLoad(e);
            }}
            onError={(e) => {
              setLoaded(false);
              setError(true);
              if (typeof local.onError === "function") local.onError(e);
            }}
          />
          <Show when={error() && !explicit()}>
            <span data-streamdown="image-fallback">
              {t("imageNotAvailable")}
            </span>
          </Show>
          <Show when={p.showControls !== false}>
            <div class="sd-image-overlay" data-streamdown="image-overlay" />
          </Show>
          <Show
            when={
              (loaded() || explicit()) &&
              !error() &&
              p.showControls !== false &&
              p.showDownloadControl !== false
            }
          >
            <button
              type="button"
              title={t("downloadImage")}
              aria-label={t("downloadImage")}
              onClick={() => void download()}
            >
              <UiIcon name="DownloadIcon" />
            </button>
          </Show>
        </Show>
      </div>
    </Show>
  );
}
