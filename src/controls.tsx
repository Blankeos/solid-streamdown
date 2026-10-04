import {
  Show,
  createSignal,
  onCleanup,
  useContext,
  type Component,
  type JSX,
} from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import type { Element } from "hast";
import { FeatureContext } from "./feature-block";

export type DownloadControlConfig = boolean | { filename: string };
export type CopyControlConfig =
  boolean | { onCopy?: () => void; onError?: (error: Error) => void };
export type CSVSeparator = "," | ";" | "\t" | "auto";
/** Supported React control subset: code and table copy/download. */
export type ControlsConfig =
  | boolean
  | {
      code?:
        | boolean
        | { copy?: CopyControlConfig; download?: DownloadControlConfig };
      table?:
        | boolean
        | {
            copy?: boolean;
            download?: DownloadControlConfig;
            csvSeparator?: CSVSeparator;
            fullscreen?: boolean;
          };
      mermaid?:
        | boolean
        | {
            copy?: CopyControlConfig;
            download?: DownloadControlConfig;
            fullscreen?: boolean;
            panZoom?: boolean;
          };
      image?: boolean | { download?: boolean };
    };
export interface StreamdownTranslations {
  // Link modal
  close: string;
  copied: string;
  // Code block
  copyCode: string;
  copyLink: string;
  // Table
  copyTable: string;
  copyTableAsCsv: string;
  copyTableAsMarkdown: string;
  copyTableAsTsv: string;
  // Mermaid
  downloadDiagram: string;
  downloadDiagramAsMmd: string;
  downloadDiagramAsPng: string;
  downloadDiagramAsSvg: string;
  downloadFile: string;
  // Image
  downloadImage: string;
  downloadTable: string;
  downloadTableAsCsv: string;
  downloadTableAsMarkdown: string;
  exitFullscreen: string;
  externalLinkWarning: string;
  imageNotAvailable: string;
  mermaidFormatMmd: string;
  mermaidFormatPng: string;
  mermaidFormatSvg: string;
  openExternalLink: string;
  openLink: string;
  resetView: string;
  tableFormatCsv: string;
  tableFormatMarkdown: string;
  tableFormatTsv: string;
  viewFullscreen: string;
  zoomIn: string;
  zoomOut: string;
}

export const defaultTranslations: StreamdownTranslations = {
  // Code block
  copyCode: "Copy Code",
  downloadFile: "Download file",
  // Mermaid
  downloadDiagram: "Download diagram",
  downloadDiagramAsSvg: "Download diagram as SVG",
  downloadDiagramAsPng: "Download diagram as PNG",
  downloadDiagramAsMmd: "Download diagram as MMD",
  viewFullscreen: "View fullscreen",
  exitFullscreen: "Exit fullscreen",
  mermaidFormatSvg: "SVG",
  mermaidFormatPng: "PNG",
  mermaidFormatMmd: "MMD",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetView: "Reset zoom and pan",
  // Table
  copyTable: "Copy table",
  copyTableAsMarkdown: "Copy table as Markdown",
  copyTableAsCsv: "Copy table as CSV",
  copyTableAsTsv: "Copy table as TSV",
  downloadTable: "Download table",
  downloadTableAsCsv: "Download table as CSV",
  downloadTableAsMarkdown: "Download table as Markdown",
  tableFormatMarkdown: "Markdown",
  tableFormatCsv: "CSV",
  tableFormatTsv: "TSV",
  // Image
  imageNotAvailable: "Image not available",
  downloadImage: "Download image",
  // Link modal
  openExternalLink: "Open external link?",
  externalLinkWarning: "You're about to visit an external website.",
  close: "Close",
  copyLink: "Copy link",
  copied: "Copied",
  openLink: "Open link",
};

export type IconComponent = Component<
  JSX.SvgSVGAttributes<SVGSVGElement> & { size?: number }
>;
export interface IconMap {
  CopyIcon: IconComponent;
  CheckIcon: IconComponent;
  DownloadIcon: IconComponent;
  ExternalLinkIcon: IconComponent;
  Loader2Icon: IconComponent;
  Maximize2Icon: IconComponent;
  RotateCcwIcon: IconComponent;
  XIcon: IconComponent;
  ZoomInIcon: IconComponent;
  ZoomOutIcon: IconComponent;
}
const icon =
  (path: string): IconComponent =>
  (props) => (
    <svg
      aria-hidden="true"
      data-streamdown-icon="true"
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      {...props}
    >
      <path d={path} />
    </svg>
  );
export const defaultIcons: IconMap = {
  ExternalLinkIcon: icon("M15 3h6v6m0-6L10 14M12 3H3v18h18v-9"),
  Loader2Icon: icon("M12 3a9 9 0 1 1-9 9"),
  Maximize2Icon: icon("M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"),
  RotateCcwIcon: icon("M3 10a9 9 0 1 1 2 9M3 3v7h7"),
  XIcon: icon("m6 6 12 12M6 18 18 6"),
  ZoomInIcon: icon(
    "M11 7v8m-4-4h8m1 5 5 5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  ),
  ZoomOutIcon: icon("M7 11h8m1 5 5 5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"),
  CopyIcon: icon("M9 9h12v12H9z M15 5V3H3v12h2"),
  CheckIcon: icon("m5 12 4 4 10-10"),
  DownloadIcon: icon("M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"),
};
export function BlockControls(props: {
  kind: "code" | "table";
  text: () => string;
  extension?: string;
  format?: "csv" | "markdown" | "tsv";
}) {
  const context = useContext(FeatureContext)!;
  const config = () => {
    const controls = context.controls ?? false;
    return typeof controls === "boolean"
      ? controls
      : (controls[props.kind] ?? true);
  };
  const setting = (action: "copy" | "download") => {
    const value = config();
    return typeof value === "boolean" ? value : (value[action] ?? true);
  };
  const t = (key: keyof StreamdownTranslations) =>
    context.translations?.[key] ?? defaultTranslations[key];
  const label = (action: "copy" | "download") => {
    if (props.kind === "code")
      return t(action === "copy" ? "copyCode" : "downloadFile");
    const suffix =
      props.format === "markdown"
        ? "Markdown"
        : props.format === "tsv"
          ? "Tsv"
          : "Csv";
    return t(`${action}TableAs${suffix}` as keyof StreamdownTranslations);
  };
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal("");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
  });
  const callbacks = () => {
    const value = setting("copy");
    return typeof value === "object"
      ? (value as Exclude<CopyControlConfig, boolean>)
      : {};
  };
  const fail = (cause: unknown, notifyCopy = false) => {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (!disposed) setError(error.message);
    if (notifyCopy && !disposed) callbacks().onError?.(error);
  };
  const copy = async () => {
    if (isServer || context.isAnimating || copied()) return;
    setError("");
    try {
      if (!globalThis.navigator?.clipboard?.writeText)
        throw new Error("Clipboard API not available");
      await navigator.clipboard.writeText(props.text());
      if (disposed) return;
      setCopied(true);
      callbacks().onCopy?.();
      timer = setTimeout(() => setCopied(false), 2000);
    } catch (cause) {
      fail(cause, true);
    }
  };
  const download = () => {
    if (isServer || context.isAnimating) return;
    setError("");
    try {
      const value = setting("download");
      const name =
        typeof value === "object" && "filename" in value
          ? value.filename
          : undefined;
      const extension = props.extension ?? "txt";
      const url = URL.createObjectURL(
        new Blob([props.text()], {
          type:
            extension === "csv"
              ? "text/csv;charset=utf-8"
              : "text/plain;charset=utf-8",
        }),
      );
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = `${name || (props.kind === "code" ? "file" : "table")}.${extension}`;
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (cause) {
      fail(cause);
    }
  };
  const Icon = (props: { name: keyof IconMap }) => (
    <Dynamic
      component={context.icons?.[props.name] ?? defaultIcons[props.name]}
      size={14}
      aria-hidden="true"
    />
  );
  return (
    <>
      <Show when={setting("copy")}>
        <button
          type="button"
          data-streamdown={`${props.kind === "code" ? "code-block" : "table"}-copy-button`}
          aria-label={label("copy")}
          title={label("copy")}
          disabled={context.isAnimating}
          onClick={copy}
        >
          <Icon name={copied() ? "CheckIcon" : "CopyIcon"} />
        </button>
      </Show>
      <Show when={props.format !== "tsv" && setting("download")}>
        <button
          type="button"
          data-streamdown={`${props.kind === "code" ? "code-block" : "table"}-download-button`}
          aria-label={label("download")}
          title={label("download")}
          disabled={context.isAnimating}
          onClick={download}
        >
          <Icon name="DownloadIcon" />
        </button>
      </Show>
      <Show when={copied()}>
        <output class="sd-sr-only" aria-live="polite">
          {t("copied")}
        </output>
      </Show>
      <Show when={error()}>
        <span role="alert">{error()}</span>
      </Show>
    </>
  );
}

function text(node: Element["children"][number]): string {
  if (node.type === "text") return node.value;
  if (node.type !== "element") return "";
  return node.tagName === "br" ? "\n" : node.children.map(text).join("");
}
export function tableText(
  element: Element,
  format: "csv" | "markdown" | "tsv",
  separator: CSVSeparator = ",",
): string {
  const rows: string[][] = [];
  const visit = (node: Element) => {
    if (node.tagName === "tr")
      rows.push(
        node.children
          .filter(
            (child): child is Element =>
              child.type === "element" &&
              (child.tagName === "td" || child.tagName === "th"),
          )
          .map((cell) => text(cell).trim()),
      );
    else
      node.children.forEach((child) => {
        if (child.type === "element") visit(child);
      });
  };
  visit(element);
  if (format === "markdown")
    return rows
      .flatMap((row, index) => {
        const line = `| ${row.map((value) => value.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
        return index === 0
          ? [line, `| ${row.map(() => "---").join(" | ")} |`]
          : [line];
      })
      .join("\n");
  const sep =
    format === "tsv"
      ? "\t"
      : separator === "auto"
        ? Intl.NumberFormat().format(1.1).includes(",")
          ? ";"
          : ","
        : separator;
  return rows
    .map((row) =>
      row
        .map((value) =>
          value.includes(sep) || /["\n\r]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value,
        )
        .join(sep),
    )
    .join("\n");
}
export function maxHeight(value?: number | string): string | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 ? `${value}px` : undefined;
  return !value || value === "0" || value === "none" || value === "Infinity"
    ? undefined
    : value;
}
