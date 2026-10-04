/**
 * Adapted from Vercel Streamdown 2.7.0.
 * Copyright 2023 Vercel, Inc.
 * Licensed under Apache-2.0; see LICENSE-STREAMDOWN and ATTRIBUTION.md.
 */

import {
  createContext,
  useContext,
  createSignal,
  onCleanup,
  splitProps,
  Show,
  Index,
  createEffect,
  type JSX,
} from "solid-js";
import { isServer } from "solid-js/web";
import { type HighlightToken, type HighlightResult } from "./plugin-types";
import { maxHeight } from "./controls";
import { pinnedScroll } from "./pinned-scroll";
import {
  useFeatures,
  useTranslation,
  UiIcon,
  useCn,
  save,
  filename,
  type HostProps,
} from "./ui-utils";
import { languageExtensionMap } from "./language-extensions";
// Redirect colors and font styles to variables so dual-theme CSS can switch
// without !important, while providers with only ordinary styles retain them.
function tokenStyle(token: HighlightToken): JSX.CSSProperties {
  const style: Record<string, string> = {};
  if (token.color) style["--sdm-c"] = token.color;
  if (token.bgColor) style["--sdm-tbg"] = token.bgColor;
  const mapping: Record<string, string> = {
    color: "--sdm-c",
    "background-color": "--sdm-tbg",
    "font-style": "--sdm-font-style",
    "font-weight": "--sdm-font-weight",
    "text-decoration": "--sdm-text-decoration",
  };
  for (const [key, value] of Object.entries(token.htmlStyle ?? {}))
    style[mapping[key] ?? key] = value;
  return style;
}
function preStyle(result?: HighlightResult): JSX.CSSProperties {
  const style: Record<string, string> = {};
  if (result?.bg) style["--sdm-bg"] = result.bg;
  if (result?.fg) style["--sdm-fg"] = result.fg;
  for (const decl of (result?.rootStyle || "").split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) {
      const key = decl.slice(0, i).trim(),
        value = decl.slice(i + 1).trim();
      if (value)
        style[
          key === "background-color"
            ? "--sdm-bg"
            : key === "color"
              ? "--sdm-fg"
              : key
        ] = value;
    }
  }
  return style;
}
const CodeContext = createContext<{ code: string }>({ code: "" });
export function CodeBlockContainer(
  p: HostProps<"div"> & { language: string; isIncomplete?: boolean },
) {
  const [local, rest] = splitProps(p, [
    "language",
    "isIncomplete",
    "style",
    "className",
    "class",
    "node",
  ]);
  const cn = useCn();
  return (
    <div
      {...rest}
      style={
        typeof local.style === "string"
          ? `content-visibility:auto;contain-intrinsic-size:auto 200px;${local.style}`
          : {
              "content-visibility": "auto",
              "contain-intrinsic-size": "auto 200px",
              ...local.style,
            }
      }
      data-streamdown="code-block"
      data-language={p.language}
      data-incomplete={p.isIncomplete || undefined}
      class={`sd-block ${cn("relative my-4 flex w-full flex-col gap-2 rounded-xl border border-border bg-sidebar p-2", local.className, local.class)}`}
    />
  );
}
export function CodeBlockHeader(p: { language: string }) {
  const cn = useCn();
  return (
    <div
      class={`sd-code-header ${cn("flex h-8 items-center text-muted-foreground text-xs")}`}
      data-streamdown="code-block-header"
      data-language={p.language}
    >
      <span class={cn("ml-1 font-mono lowercase")}>{p.language}</span>
    </div>
  );
}
export function CodeBlockSkeleton() {
  const cn = useCn();
  return (
    <div
      class={`sd-code-skeleton ${cn("w-full divide-y divide-border overflow-hidden rounded-xl border border-border")}`}
      aria-busy="true"
    >
      <div
        class={`sd-code-skeleton-header ${cn("h-[46px] w-full bg-muted/80")}`}
      />
      <div
        class={`sd-code-skeleton-body ${cn("flex w-full items-center justify-center p-4")}`}
      >
        <UiIcon name="Loader2Icon" className={cn("size-4 animate-spin")} />
      </div>
    </div>
  );
}
export type CodeBlockCopyButtonProps = Omit<HostProps<"button">, "onError"> & {
  onCopy?: () => void;
  onError?: (e: Error) => void;
  timeout?: number;
  code?: string;
};
export function CodeBlockCopyButton(p: CodeBlockCopyButtonProps) {
  const cn = useCn();
  const c = useFeatures(),
    t = useTranslation(),
    ctx = useContext(CodeContext);
  const [local, rest] = splitProps(p, [
    "onCopy",
    "onError",
    "timeout",
    "code",
    "children",
    "className",
    "class",
    "node",
  ]);
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal("");
  let timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    pending = false;
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
  });
  const copy = async () => {
    if (pending || copied() || c.isAnimating) return;
    pending = true;
    try {
      if (isServer || !navigator.clipboard?.writeText)
        throw new Error("Clipboard API not available");
      await navigator.clipboard.writeText(p.code ?? ctx.code);
      if (disposed) return;
      setCopied(true);
      p.onCopy?.();
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), p.timeout ?? 2000);
    } catch (e) {
      if (!disposed) {
        const failure = e instanceof Error ? e : new Error(String(e));
        setError(failure.message);
        p.onError?.(failure);
      }
    } finally {
      pending = false;
    }
  };
  return (
    <>
      <button
        type="button"
        aria-label={t("copyCode")}
        title={t("copyCode")}
        disabled={c.isAnimating}
        onClick={copy}
        {...rest}
        class={`sd-control ${cn("cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground", local.className, local.class)}`}
        data-streamdown="code-block-copy-button"
      >
        {p.children ?? <UiIcon name={copied() ? "CheckIcon" : "CopyIcon"} />}
      </button>
      <Show when={error()}>
        <span role="alert">{error()}</span>
      </Show>
      <Show when={copied()}>
        <output class="sd-sr-only" aria-live="polite">
          {t("copied")}
        </output>
      </Show>
    </>
  );
}
export type CodeBlockDownloadButtonProps = Omit<
  HostProps<"button">,
  "onError"
> & {
  onDownload?: () => void;
  onError?: (e: Error) => void;
  code?: string;
  language?: string;
};
export function CodeBlockDownloadButton(p: CodeBlockDownloadButtonProps) {
  const cn = useCn();
  const c = useFeatures(),
    ctx = useContext(CodeContext),
    t = useTranslation();
  const [local, rest] = splitProps(p, [
    "onDownload",
    "onError",
    "code",
    "language",
    "children",
    "className",
    "class",
    "node",
  ]);
  return (
    <button
      type="button"
      disabled={c.isAnimating}
      title={t("downloadFile")}
      aria-label={t("downloadFile")}
      onClick={() => {
        try {
          save(
            `${filename(c.controls, "code", "file")}.${languageExtensionMap[p.language ?? ""] ?? "txt"}`,
            p.code ?? ctx.code,
          );
          p.onDownload?.();
        } catch (e) {
          p.onError?.(e as Error);
        }
      }}
      {...rest}
      class={`sd-control ${cn("cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground", local.className, local.class)}`}
      data-streamdown="code-block-download-button"
    >
      {p.children ?? <UiIcon name="DownloadIcon" />}
    </button>
  );
}
export function CodeBlock(
  p: HostProps<"div"> & {
    code: string;
    language: string;
    isIncomplete?: boolean;
    startLine?: number;
    lineNumbers?: boolean;
  },
) {
  const cn = useCn();
  const c = useFeatures();
  const [local, rest] = splitProps(p, [
    "code",
    "language",
    "isIncomplete",
    "startLine",
    "lineNumbers",
    "children",
    "className",
    "class",
    "node",
    "style",
  ]);
  const raw = () => p.code.replace(/\n+$/, "");
  const [result, setResult] = createSignal<HighlightResult>();
  createEffect(() => {
    const plugin = c.plugins?.code,
      code = raw(),
      language = p.language,
      isIncomplete = p.isIncomplete;
    let stopped = false;
    onCleanup(() => (stopped = true));
    setResult(undefined);
    if (plugin) {
      const value = plugin.highlight(
        {
          code,
          language: language as never,
          themes: c.shikiTheme ?? plugin.getThemes(),
          isIncomplete,
        },
        (value) => {
          if (!stopped) setResult(value);
        },
      );
      if (value) setResult(value);
    }
  });
  return (
    <CodeContext.Provider
      value={{
        get code() {
          return p.code;
        },
      }}
    >
      <CodeBlockContainer
        language={p.language}
        isIncomplete={p.isIncomplete}
        dir="ltr"
      >
        <CodeBlockHeader language={p.language} />
        <Show when={p.children}>
          <div
            class={`sd-code-actions ${cn("pointer-events-none absolute top-2 right-2 z-10 flex items-center")}`}
          >
            <div
              class={`sd-controls sd-code-action-panel ${cn("pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-[backdrop-filter]:bg-sidebar/70 supports-[backdrop-filter]:backdrop-blur")}`}
              data-streamdown="code-block-actions"
            >
              {p.children}
            </div>
          </div>
        </Show>
        <div
          {...rest}
          data-streamdown="code-block-body"
          class={`sd-code ${cn("overflow-x-auto rounded-md border border-border bg-background p-4 text-sm", local.className, local.class)}`}
          data-language={p.language}
          ref={pinnedScroll(
            () => c.isAnimating ?? false,
            () => !!maxHeight(c.codeBlockMaxHeight),
          )}
          style={
            typeof local.style === "string"
              ? `max-height:${maxHeight(c.codeBlockMaxHeight) ?? "none"};overflow:auto;${local.style}`
              : {
                  "max-height": maxHeight(c.codeBlockMaxHeight) ?? "none",
                  overflow: "auto",
                  ...local.style,
                }
          }
        >
          <pre style={preStyle(result())}>
            <code class={`language-${p.language}`}>
              <Index
                each={
                  result()?.tokens ??
                  raw()
                    .split("\n")
                    .map((content) => [
                      {
                        content,
                        color: "inherit",
                        bgColor: "transparent",
                        htmlStyle: {},
                        htmlAttrs: {},
                        offset: 0,
                      },
                    ])
                }
              >
                {(line, i) => (
                  <>
                    <span
                      class="sd-code-line"
                      data-line={
                        (p.lineNumbers ?? c.lineNumbers) !== false
                          ? i +
                            (p.startLine && p.startLine > 1 ? p.startLine : 1)
                          : undefined
                      }
                    >
                      <Index each={line()}>
                        {(token) => (
                          <span
                            {...token().htmlAttrs}
                            class="sd-code-token"
                            style={tokenStyle(token())}
                          >
                            {token().content}
                          </span>
                        )}
                      </Index>
                    </span>
                    {i <
                    (result()?.tokens.length ?? raw().split("\n").length) - 1
                      ? "\n"
                      : ""}
                  </>
                )}
              </Index>
            </code>
          </pre>
        </div>
      </CodeBlockContainer>
    </CodeContext.Provider>
  );
}
