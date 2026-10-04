/**
 * Adapted from Vercel Streamdown 2.7.0.
 * Copyright 2023 Vercel, Inc.
 * Licensed under Apache-2.0; see LICENSE-STREAMDOWN and ATTRIBUTION.md.
 */

import {
  Show,
  For,
  createSignal,
  createEffect,
  onCleanup,
  splitProps,
  type JSX,
} from "solid-js";
import {
  useFeatures,
  useCn,
  useTranslation,
  UiIcon,
  save,
  filename,
  type HostProps,
} from "./ui-utils";
import {
  extractTableDataFromElement,
  getTableCsvSeparator,
  tableDataToCSV,
  tableDataToMarkdown,
  tableDataToTSV,
} from "./table-utils";
import { Overlay } from "./portal";
import { maxHeight } from "./controls";
import { pinnedScroll } from "./pinned-scroll";
export function Dropdown(p: {
  label: string;
  children?: JSX.Element;
  className?: string;
  disabled?: boolean;
  options: { label: string; title: string; action: () => void }[];
  open: boolean;
  setOpen: (v: boolean) => void;
  ref?: (el: HTMLDivElement) => void;
}) {
  const cn = useCn();
  let node!: HTMLDivElement, trigger!: HTMLButtonElement;
  createEffect(() => {
    if (!p.open) return;
    const outside = (e: MouseEvent) => {
      if (!e.composedPath().includes(node)) p.setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    onCleanup(() => document.removeEventListener("mousedown", outside));
  });
  return (
    <div
      class={`sd-dropdown ${cn("relative")}`}
      ref={(el) => {
        node = el;
        p.ref?.(el);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          p.setOpen(false);
          trigger.focus();
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          if (!p.open) p.setOpen(true);
          queueMicrotask(() => {
            const buttons = Array.from(
              node.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
            );
            const current = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const index =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : e.key === "ArrowDown"
                    ? (current + 1) % buttons.length
                    : (current - 1 + buttons.length) % buttons.length;
            buttons[index]?.focus();
          });
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        class={`sd-control ${cn("cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground", p.className)}`}
        title={p.label}
        aria-label={p.label}
        aria-haspopup="menu"
        aria-expanded={p.open}
        disabled={p.disabled}
        onClick={() => p.setOpen(!p.open)}
      >
        {p.children}
      </button>
      <Show when={p.open}>
        <div
          class={`sd-menu ${cn("absolute top-full right-0 z-20 mt-1 min-w-[120px] overflow-hidden rounded-md border border-border bg-background shadow-lg")}`}
          role="menu"
          aria-label={p.label}
        >
          <For each={p.options}>
            {(item) => (
              <button
                class={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40",
                )}
                role="menuitem"
                type="button"
                title={item.title}
                aria-label={item.title}
                onClick={item.action}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
export interface TableCopyDropdownProps {
  children?: JSX.Element;
  className?: string;
  onCopy?: (format: "csv" | "tsv" | "md") => void;
  onError?: (e: Error) => void;
  timeout?: number;
}
export interface TableDownloadDropdownProps {
  children?: JSX.Element;
  className?: string;
  onDownload?: (format: "csv" | "markdown") => void;
  onError?: (e: Error) => void;
}
export interface TableDownloadButtonProps {
  children?: JSX.Element;
  className?: string;
  filename?: string;
  format?: "csv" | "markdown";
  onDownload?: () => void;
  onError?: (e: Error) => void;
}
function getTable(node: HTMLElement) {
  const table = node
    .closest('[data-streamdown="table-wrapper"]')
    ?.querySelector("table");
  if (!table) throw new Error("Table not found");
  return table;
}
function content(table: HTMLElement, format: string, controls: unknown) {
  const data = extractTableDataFromElement(table);
  return format === "csv"
    ? tableDataToCSV(data, getTableCsvSeparator(controls as never))
    : format === "tsv"
      ? tableDataToTSV(data)
      : tableDataToMarkdown(data);
}
export function TableCopyDropdown(p: TableCopyDropdownProps) {
  const c = useFeatures(),
    t = useTranslation();
  const [open, setOpen] = createSignal(false),
    [copied, setCopied] = createSignal(false);
  let node!: HTMLDivElement,
    timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    pending = false;
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
  });
  const copy = async (format: "csv" | "tsv" | "md") => {
    if (pending || c.isAnimating) return;
    pending = true;
    try {
      const table = getTable(node),
        plain = content(table, format, c.controls);
      if (!navigator.clipboard) throw new Error("Clipboard API not available");
      if (navigator.clipboard.write && typeof ClipboardItem !== "undefined")
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plain], { type: "text/plain" }),
            "text/html": new Blob([table.outerHTML], { type: "text/html" }),
          }),
        ]);
      else if (navigator.clipboard.writeText)
        await navigator.clipboard.writeText(plain);
      else throw new Error("Clipboard API not available");
      if (disposed) return;
      setCopied(true);
      setOpen(false);
      p.onCopy?.(format);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), p.timeout ?? 2000);
    } catch (e) {
      if (!disposed) p.onError?.(e as Error);
    } finally {
      pending = false;
    }
  };
  return (
    <>
      <Dropdown
        ref={(el) => (node = el)}
        label={t("copyTable")}
        className={p.className}
        disabled={c.isAnimating}
        open={open()}
        setOpen={setOpen}
        options={(["md", "csv", "tsv"] as const).map((format) => ({
          label: t(
            format === "md"
              ? "tableFormatMarkdown"
              : format === "csv"
                ? "tableFormatCsv"
                : "tableFormatTsv",
          ),
          title: t(
            format === "md"
              ? "copyTableAsMarkdown"
              : format === "csv"
                ? "copyTableAsCsv"
                : "copyTableAsTsv",
          ),
          action: () => void copy(format),
        }))}
      >
        {p.children ?? <UiIcon name={copied() ? "CheckIcon" : "CopyIcon"} />}
      </Dropdown>
      <Show when={copied()}>
        <output class="sd-sr-only" aria-live="polite">
          {t("copied")}
        </output>
      </Show>
    </>
  );
}
export function TableDownloadDropdown(p: TableDownloadDropdownProps) {
  const c = useFeatures(),
    t = useTranslation();
  const [open, setOpen] = createSignal(false);
  let node!: HTMLDivElement;
  const download = (format: "csv" | "markdown") => {
    try {
      save(
        `${filename(c.controls, "table", "table")}.${format === "csv" ? "csv" : "md"}`,
        content(getTable(node), format, c.controls),
        format === "csv" ? "text/csv" : "text/markdown",
      );
      setOpen(false);
      p.onDownload?.(format);
    } catch (e) {
      p.onError?.(e as Error);
    }
  };
  return (
    <Dropdown
      ref={(el) => (node = el)}
      label={t("downloadTable")}
      className={p.className}
      disabled={c.isAnimating}
      open={open()}
      setOpen={setOpen}
      options={(["csv", "markdown"] as const).map((format) => ({
        label: t(format === "csv" ? "tableFormatCsv" : "tableFormatMarkdown"),
        title: t(
          format === "csv" ? "downloadTableAsCsv" : "downloadTableAsMarkdown",
        ),
        action: () => download(format),
      }))}
    >
      {p.children ?? <UiIcon name="DownloadIcon" />}
    </Dropdown>
  );
}
export function TableDownloadButton(p: TableDownloadButtonProps) {
  const cn = useCn();
  const c = useFeatures(),
    t = useTranslation();
  return (
    <button
      type="button"
      class={`sd-control ${cn("cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground", p.className)}`}
      disabled={c.isAnimating}
      title={t(
        p.format === "markdown"
          ? "downloadTableAsMarkdown"
          : "downloadTableAsCsv",
      )}
      onClick={(e) => {
        try {
          const format = p.format ?? "csv";
          save(
            `${p.filename || filename(c.controls, "table", "table")}.${format === "csv" ? "csv" : "md"}`,
            content(getTable(e.currentTarget), format, c.controls),
            format === "csv" ? "text/csv" : "text/markdown",
          );
          p.onDownload?.();
        } catch (e) {
          p.onError?.(e as Error);
        }
      }}
    >
      {p.children ?? <UiIcon name="DownloadIcon" />}
    </button>
  );
}
export function Table(
  p: HostProps<"table"> & {
    maxHeight?: number | string;
    showControls?: boolean;
    showCopy?: boolean;
    showDownload?: boolean;
    showFullscreen?: boolean;
  },
) {
  const cn = useCn();
  const c = useFeatures(),
    t = useTranslation();
  const [local, rest] = splitProps(p, [
    "maxHeight",
    "showControls",
    "showCopy",
    "showDownload",
    "showFullscreen",
    "className",
    "class",
    "node",
    "children",
  ]);
  const [full, setFull] = createSignal(false);
  let table!: HTMLTableElement;
  let home!: HTMLDivElement;
  // Move the actual owned node, not a serialized copy. Solid's owner and all
  // reactive computations stay alive at home while the DOM lives in the portal.
  const moveTable = (target: HTMLDivElement) => {
    target.appendChild(table);
    onCleanup(() => home.appendChild(table));
  };
  return (
    <div class="sd-block" data-streamdown="table-wrapper">
      <Show when={p.showControls}>
        <div class="sd-controls">
          <Show when={p.showCopy !== false}>
            <TableCopyDropdown />
          </Show>
          <Show when={p.showDownload !== false}>
            <TableDownloadDropdown />
          </Show>
          <Show when={p.showFullscreen !== false}>
            <button
              type="button"
              title={t("viewFullscreen")}
              aria-label={t("viewFullscreen")}
              disabled={c.isAnimating}
              onClick={() => setFull(true)}
            >
              <UiIcon name="Maximize2Icon" />
            </button>
          </Show>
        </div>
      </Show>
      <div
        class="sd-scroll"
        style={{ "max-height": maxHeight(p.maxHeight), overflow: "auto" }}
        ref={(el) => {
          home = el;
          pinnedScroll(
            () => c.isAnimating ?? false,
            () => !!maxHeight(p.maxHeight),
          )(el);
        }}
      >
        <table
          {...rest}
          ref={table}
          class={cn(local.className, local.class)}
          data-streamdown="table"
        >
          {p.children}
        </table>
      </div>
      <Overlay
        open={full()}
        onClose={() => setFull(false)}
        kind="table-fullscreen"
      >
        <div data-streamdown="table-wrapper" class="sd-fullscreen-content">
          <div class="sd-controls">
            <Show when={p.showCopy !== false}>
              <TableCopyDropdown />
            </Show>
            <Show when={p.showDownload !== false}>
              <TableDownloadDropdown />
            </Show>
          </div>
          <div ref={moveTable} />
        </div>
      </Overlay>
    </div>
  );
}
