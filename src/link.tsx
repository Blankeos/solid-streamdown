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
} from "solid-js";
import { isServer } from "solid-js/web";
import { Overlay } from "./portal";
import {
  useFeatures,
  useCn,
  useTranslation,
  UiIcon,
  type HostProps,
} from "./ui-utils";
export function LinkComponent(p: HostProps<"a">) {
  const cn = useCn();
  const c = useFeatures(),
    t = useTranslation();
  const [local, rest] = splitProps(p, [
    "href",
    "children",
    "className",
    "class",
    "node",
  ]);
  const [open, setOpen] = createSignal(false),
    [copied, setCopied] = createSignal(false);
  let revision = 0,
    disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    disposed = true;
    ++revision;
    clearTimeout(timer);
  });
  createEffect(() => {
    p.href;
    ++revision;
    setOpen(false);
    setCopied(false);
    clearTimeout(timer);
  });
  const confirm = () => {
    if (!isServer && p.href) window.open(p.href, "_blank", "noreferrer");
  };
  const modal = {
    get url() {
      return p.href ?? "";
    },
    get isOpen() {
      return open();
    },
    onClose: () => setOpen(false),
    onConfirm: confirm,
  };
  const check = async () => {
    const current = ++revision,
      url = p.href;
    if (!url || url === "streamdown:incomplete-link") return;
    try {
      if (await c.linkSafety?.onLinkCheck?.(url)) {
        if (!disposed && current === revision) confirm();
      } else if (!disposed && current === revision) setOpen(true);
    } catch {
      if (!disposed && current === revision) setOpen(true);
    }
  };
  return (
    <Show
      when={c.linkSafety?.enabled && p.href}
      fallback={
        <a
          href={p.href}
          class={`sd-link ${cn("wrap-anywhere font-medium text-primary underline", local.className, local.class)}`}
          data-streamdown="link"
          data-incomplete={p.href === "streamdown:incomplete-link"}
          target="_blank"
          rel="noreferrer"
          {...rest}
        >
          {p.children}
        </a>
      }
    >
      <button
        type="button"
        data-streamdown="link"
        data-incomplete={p.href === "streamdown:incomplete-link"}
        class={`sd-link ${cn("wrap-anywhere font-medium text-primary underline", local.className, local.class)}`}
        onClick={() => void check()}
        style={{
          background: "none",
          border: "none",
          padding: "0",
          "font-family": "inherit",
          "font-size": "inherit",
          cursor: "pointer",
          "text-align": "left",
        }}
      >
        {p.children}
      </button>
      <Show
        when={c.linkSafety?.renderModal}
        fallback={
          <Overlay
            open={open()}
            onClose={modal.onClose}
            label={t("openExternalLink")}
            kind="link-safety-modal"
          >
            <div
              class={`sd-link-modal ${cn("relative mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border bg-background p-6 shadow-lg")}`}
              data-streamdown="link-modal"
            >
              <h2>
                <UiIcon name="ExternalLinkIcon" size={20} />
                {t("openExternalLink")}
              </h2>
              <p>{t("externalLinkWarning")}</p>
              <div
                class={`sd-link-url ${cn("break-all rounded-md bg-muted p-3 font-mono text-sm", (p.href?.length ?? 0) > 100 && "max-h-32 overflow-y-auto")}`}
              >
                {p.href}
              </div>
              <button
                class={`sd-link-close ${cn("absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground")}`}
                aria-label={t("close")}
                type="button"
                onClick={modal.onClose}
              >
                <UiIcon name="XIcon" size={16} />
              </button>
              <div class={`sd-link-buttons ${cn("flex gap-2")}`}>
                <button
                  class={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 font-medium text-sm transition-all hover:bg-muted",
                  )}
                  type="button"
                  onClick={async () => {
                    const current = revision;
                    try {
                      await navigator.clipboard.writeText(p.href ?? "");
                      if (disposed || current !== revision) return;
                      setCopied(true);
                      clearTimeout(timer);
                      timer = setTimeout(() => setCopied(false), 2000);
                    } catch {}
                  }}
                >
                  <UiIcon name={copied() ? "CheckIcon" : "CopyIcon"} />
                  {copied() ? t("copied") : t("copyLink")}
                </button>
                <button
                  class={`sd-link-confirm ${cn("flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm")}`}
                  type="button"
                  onClick={() => {
                    confirm();
                    modal.onClose();
                  }}
                >
                  <UiIcon name="ExternalLinkIcon" />
                  {t("openLink")}
                </button>
              </div>
            </div>
          </Overlay>
        }
      >
        {(render) => render()(modal)}
      </Show>
    </Show>
  );
}
