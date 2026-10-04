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
          };
    };
export interface StreamdownTranslations {
  copyCode: string;
  downloadFile: string;
  copied: string;
  copyTable: string;
  copyTableAsCsv: string;
  copyTableAsMarkdown: string;
  copyTableAsTsv: string;
  downloadTable: string;
  downloadTableAsCsv: string;
  downloadTableAsMarkdown: string;
  tableFormatCsv: string;
  tableFormatMarkdown: string;
  tableFormatTsv: string;
}
export const defaultTranslations: StreamdownTranslations = {
  copyCode: "Copy Code",
  downloadFile: "Download file",
  copied: "Copied",
  copyTable: "Copy table",
  copyTableAsCsv: "Copy table as CSV",
  copyTableAsMarkdown: "Copy table as Markdown",
  copyTableAsTsv: "Copy table as TSV",
  downloadTable: "Download table",
  downloadTableAsCsv: "Download table as CSV",
  downloadTableAsMarkdown: "Download table as Markdown",
  tableFormatCsv: "CSV",
  tableFormatMarkdown: "Markdown",
  tableFormatTsv: "TSV",
};
export type IconComponent = Component<
  JSX.SvgSVGAttributes<SVGSVGElement> & { size?: number }
>;
export interface IconMap {
  CopyIcon: IconComponent;
  CheckIcon: IconComponent;
  DownloadIcon: IconComponent;
}
const icon =
  (path: string): IconComponent =>
  (props) => (
    <svg
      aria-hidden="true"
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
