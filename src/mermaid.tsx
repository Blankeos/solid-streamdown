import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import DOMPurify from "dompurify";
import {
  useFeatures,
  useTranslation,
  UiIcon,
  control,
  filename,
  save,
} from "./ui-utils";
import { Overlay } from "./portal";
import { Dropdown } from "./table";
import { CodeBlockCopyButton } from "./code-block";
import {
  resolveMermaidMaxHeight,
  getMermaidSvgSize,
  normalizeMermaidInlineSvg,
  serializeSvgForDownload,
  svgToPngBlob,
} from "./mermaid-utils";
export function sanitizeMermaid(svg: string) {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
    HTML_INTEGRATION_POINTS: { foreignobject: true },
    FORBID_TAGS: ["script"],
  });
}
export function PanZoom(p: {
  children: JSX.Element;
  contentSize?: { width: number; height: number } | null;
  fitKey?: string;
  fullscreen?: boolean;
  initialZoom?: number;
  isAutoFit?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  showControls?: boolean;
  className?: string;
}) {
  const t = useTranslation();
  const [node, setNode] = createSignal<HTMLDivElement>(),
    [zoom, setZoom] = createSignal(p.initialZoom ?? 1),
    [pan, setPan] = createSignal({ x: 0, y: 0 }),
    [height, setHeight] = createSignal<number>();
  const [minimum, setMinimum] = createSignal(p.minZoom ?? 0.5);
  const [panning, setPanning] = createSignal(false);
  let base = p.initialZoom ?? 1,
    user = false,
    start:
      { x: number; y: number; px: number; py: number; id: number } | undefined;
  const change = (delta: number) => {
    user = true;
    setZoom((z) => Math.max(minimum(), Math.min(p.maxZoom ?? 3, z + delta)));
  };
  createEffect(() => {
    p.fitKey;
    user = false;
    setPan({ x: 0, y: 0 });
  });
  createEffect(() => {
    p.fitKey;
    const el = node(),
      size = p.contentSize;
    if (!el) return;
    const fit = () => {
      if (!p.isAutoFit || !size) return;
      if (!(el.clientWidth > 0 && size.width > 0 && size.height > 0)) return;
      const widthFit = Math.min(el.clientWidth / size.width, 1);
      let h = size.height * widthFit;
      if (p.fullscreen) {
        if (!(el.clientHeight > 0)) return;
        h = el.clientHeight;
      } else {
        let ancestor: HTMLElement | null = el;
        while (ancestor) {
          const cap = resolveMermaidMaxHeight(
            ancestor,
            getComputedStyle(ancestor).maxHeight,
          );
          if (cap !== null) {
            h = Math.min(h, cap);
            break;
          }
          ancestor = ancestor.parentElement;
        }
      }
      const fitZoom = Math.min(widthFit, h / size.height, 1);
      if (!(fitZoom > 0) || Number.isNaN(fitZoom)) return;
      base = fitZoom;
      setMinimum(Math.min(p.minZoom ?? 0.5, base));
      setHeight(p.fullscreen ? undefined : h);
      if (!user) {
        setZoom(base);
        setPan({ x: 0, y: 0 });
      }
    };
    if (!p.isAutoFit) {
      base = p.initialZoom ?? 1;
      setZoom(base);
      setMinimum(p.minZoom ?? 0.5);
      setHeight(undefined);
    }
    fit();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(fit)
        : undefined;
    observer?.observe(el);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      change(e.deltaY > 0 ? -(p.zoomStep ?? 0.1) : (p.zoomStep ?? 0.1));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    onCleanup(() => {
      observer?.disconnect();
      el.removeEventListener("wheel", wheel);
    });
  });
  return (
    <div class={`sd-panzoom ${p.className ?? ""}`}>
      <div
        ref={setNode}
        class="sd-panzoom-viewport"
        style={{
          height: height() ? `${height()}px` : undefined,
          flex: height() ? "none" : undefined,
          "touch-action": "none",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.isPrimary === false) return;
          user = true;
          setPanning(true);
          start = {
            x: e.clientX,
            y: e.clientY,
            px: pan().x,
            py: pan().y,
            id: e.pointerId,
          };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start?.id === e.pointerId) {
            e.preventDefault();
            setPan({
              x: start.px + e.clientX - start.x,
              y: start.py + e.clientY - start.y,
            });
          }
        }}
        onPointerUp={(e) => {
          if (start?.id !== e.pointerId) return;
          start = undefined;
          setPanning(false);
          if (e.currentTarget.hasPointerCapture?.(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          start = undefined;
          setPanning(false);
        }}
        onLostPointerCapture={() => {
          start = undefined;
          setPanning(false);
        }}
      >
        <div
          class="sd-panzoom-content"
          style={{
            transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
            "transform-origin": "center center",
            "user-select": panning() ? "none" : undefined,
          }}
        >
          {p.children}
        </div>
      </div>{" "}
      <Show when={p.showControls !== false}>
        <div class="sd-controls">
          <button
            type="button"
            title={t("zoomIn")}
            aria-label={t("zoomIn")}
            disabled={zoom() >= (p.maxZoom ?? 3)}
            onClick={() => change(p.zoomStep ?? 0.1)}
          >
            <UiIcon name="ZoomInIcon" />
          </button>
          <button
            type="button"
            title={t("zoomOut")}
            aria-label={t("zoomOut")}
            disabled={zoom() <= minimum()}
            onClick={() => change(-(p.zoomStep ?? 0.1))}
          >
            <UiIcon name="ZoomOutIcon" />
          </button>
          <button
            type="button"
            title={t("resetView")}
            aria-label={t("resetView")}
            onClick={() => {
              user = false;
              setZoom(base);
              setPan({ x: 0, y: 0 });
            }}
          >
            <UiIcon name="RotateCcwIcon" />
          </button>
        </div>
      </Show>
    </div>
  );
}
export function MermaidControls(p: {
  chart: string;
  svg: string;
  bindFunctions?: (el: Element) => void;
}) {
  const c = useFeatures(),
    t = useTranslation();
  const [open, setOpen] = createSignal(false),
    [full, setFull] = createSignal(false);
  let disposed = false,
    revision = 0;
  onCleanup(() => {
    disposed = true;
    ++revision;
  });
  createEffect(() => {
    p.chart;
    ++revision;
  });
  const download = async (format: "svg" | "png" | "mmd") => {
    const current = revision;
    try {
      let svg = p.svg;
      if (format !== "mmd" && !svg) {
        const result = await c.plugins?.mermaid
          ?.getMermaid(c.mermaid?.config)
          .render(
            `sd-download-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            p.chart,
          );
        svg = result?.svg ?? "";
      }
      if (disposed || current !== revision) return;
      const serialized =
        format === "mmd"
          ? p.chart
          : serializeSvgForDownload(sanitizeMermaid(svg));
      const value =
        format === "png" ? await svgToPngBlob(serialized) : serialized;
      if (disposed || current !== revision) return;
      save(
        `${filename(c.controls, "mermaid", "diagram")}.${format}`,
        value,
        format === "svg"
          ? "image/svg+xml"
          : format === "png"
            ? "image/png"
            : "text/plain",
      );
      setOpen(false);
    } catch (e) {
      if (!disposed) console.error(e);
    }
  };
  const callbacks = () => {
    const conf =
      typeof c.controls === "object" ? c.controls.mermaid : undefined;
    return typeof conf === "object" && typeof conf.copy === "object"
      ? conf.copy
      : {};
  };
  return (
    <>
      <div class="sd-controls">
        <Show when={control("mermaid", "copy")()}>
          <CodeBlockCopyButton
            code={p.chart}
            onCopy={() => callbacks().onCopy?.()}
            onError={(e: Error) => callbacks().onError?.(e)}
          />
        </Show>
        <Show when={control("mermaid", "download")()}>
          <Dropdown
            label={t("downloadDiagram")}
            disabled={c.isAnimating}
            open={open()}
            setOpen={setOpen}
            options={(["svg", "png", "mmd"] as const).map((format) => ({
              label: t(
                format === "svg"
                  ? "mermaidFormatSvg"
                  : format === "png"
                    ? "mermaidFormatPng"
                    : "mermaidFormatMmd",
              ),
              title: t(
                format === "svg"
                  ? "downloadDiagramAsSvg"
                  : format === "png"
                    ? "downloadDiagramAsPng"
                    : "downloadDiagramAsMmd",
              ),
              action: () => void download(format),
            }))}
          >
            <UiIcon name="DownloadIcon" />
          </Dropdown>
        </Show>
        <Show when={control("mermaid", "fullscreen")()}>
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
      <Overlay
        open={full()}
        onClose={() => setFull(false)}
        kind="mermaid-fullscreen"
      >
        <MermaidDiagram
          fullscreen
          chart={p.chart}
          svg={p.svg}
          bindFunctions={p.bindFunctions}
          showControls={!!control("mermaid", "panZoom")()}
        />
      </Overlay>
    </>
  );
}
export function BoundSvg(p: {
  svg: string;
  bindFunctions?: (el: Element) => void;
}) {
  const [node, setNode] = createSignal<HTMLDivElement>();
  createEffect(() => {
    const el = node(),
      svg = p.svg,
      bind = p.bindFunctions;
    if (el && svg && bind) {
      const cleanup = bind(el) as unknown;
      if (typeof cleanup === "function") onCleanup(cleanup as () => void);
    }
  });
  return (
    <div
      ref={setNode}
      class="sd-mermaid-svg"
      innerHTML={normalizeMermaidInlineSvg(sanitizeMermaid(p.svg))}
    />
  );
}

/** Inline and fullscreen diagrams share fit and navigation, even without buttons. */
export function MermaidDiagram(p: {
  chart: string;
  svg: string;
  bindFunctions?: (el: Element) => void;
  fullscreen?: boolean;
  showControls?: boolean;
}) {
  return (
    <PanZoom
      fullscreen={p.fullscreen}
      contentSize={getMermaidSvgSize(p.svg)}
      fitKey={p.chart}
      isAutoFit
      minZoom={0.1}
      showControls={p.showControls}
    >
      <BoundSvg svg={p.svg} bindFunctions={p.bindFunctions} />
    </PanZoom>
  );
}
