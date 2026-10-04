import {
  Show,
  Suspense,
  createContext,
  createEffect,
  createSignal,
  batch,
  untrack,
  onCleanup,
  useContext,
} from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import type { Element } from "hast";
import type { StreamdownProps } from "./types";
import { useIsCodeFenceIncomplete } from "./block-incomplete-context";
import {
  CodeBlock,
  CodeBlockSkeleton,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
} from "./code-block";
import { MermaidControls, MermaidDiagram, sanitizeMermaid } from "./mermaid";
import { control, useCn, type HostProps } from "./ui-utils";

let mermaidRenderId = 0;

import { FeatureContext } from "./streamdown-context";
export { FeatureContext } from "./streamdown-context";

export function fencedCode(
  element: Element,
): { code: string; language: string; meta?: string } | undefined {
  const child = element.children[0];
  if (
    element.tagName !== "pre" ||
    child?.type !== "element" ||
    child.tagName !== "code"
  )
    return;
  const classes = child.properties.className;
  const names = Array.isArray(classes)
    ? classes
    : String(classes ?? "").split(" ");
  const language = String(
    names.find((name) => String(name).startsWith("language-")) ?? "",
  ).slice(9);
  const code = child.children
    .map((node) => (node.type === "text" ? node.value : ""))
    .join("");
  return {
    code: code.replace(/\n$/, ""),
    language,
    meta: child.data?.meta as string | undefined,
  };
}

/** Native reactive code/diagram rendering; plugin promises never mutate the DOM. */
export function FeatureBlock(props: {
  element: () => Element;
  hostProps?: HostProps<"div">;
}) {
  const context = useContext(FeatureContext)!;
  const cn = useCn();
  const isIncomplete = useIsCodeFenceIncomplete();
  const [binding, setBinding] =
    createSignal<(el: globalThis.Element) => void>();
  const source = () => fencedCode(props.element())!;
  const renderer = () =>
    context.plugins?.renderers?.find((renderer) =>
      Array.isArray(renderer.language)
        ? renderer.language.includes(source().language)
        : renderer.language === source().language,
    );
  const diagram = () => {
    const plugin = context.plugins?.mermaid;
    return plugin?.language === source().language ? plugin : undefined;
  };
  const [svg, setSvg] = createSignal("");
  const [error, setError] = createSignal("");
  const [container, setContainer] = createSignal<HTMLDivElement>();
  const [ready, setReady] = createSignal(
    !isServer && typeof IntersectionObserver === "undefined",
  );
  const [retry, setRetry] = createSignal(0);
  let disposed = false;
  let inFlight = false;
  let revision = 0;
  let wake: (() => void) | undefined;
  type Request = {
    plugin: NonNullable<ReturnType<typeof diagram>>;
    config: import("./plugin-types").MermaidConfig | undefined;
    code: string;
    revision: number;
  };
  let pending: Request | undefined;
  onCleanup(() => {
    disposed = true;
    pending = undefined;
    ++revision;
    wake?.();
  });
  createEffect(() => {
    const el = container();
    if (isServer || !el || ready()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(timer);
      clearTimeout(fallback);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      idle = undefined;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        clear();
        if (!entries.at(-1)?.isIntersecting) return;
        timer = setTimeout(() => {
          const records = observer.takeRecords();
          if (records.length && !records.at(-1)?.isIntersecting) return;
          const finish = () => {
            if (disposed) return;
            observer.disconnect();
            setReady(true);
          };
          if (window.requestIdleCallback) {
            idle = window.requestIdleCallback(
              (deadline) => {
                if (deadline.didTimeout || deadline.timeRemaining() > 0)
                  finish();
                else
                  idle = window.requestIdleCallback(finish, { timeout: 250 });
              },
              { timeout: 500 },
            );
          } else fallback = setTimeout(finish, 1);
        }, 300);
      },
      { rootMargin: "300px", threshold: 0 },
    );
    observer.observe(el);
    onCleanup(() => {
      clear();
      observer.disconnect();
    });
  });
  const drain = async () => {
    if (inFlight || disposed || !untrack(ready)) return;
    inFlight = true;
    try {
      while (pending && !disposed) {
        const request = pending;
        pending = undefined;
        const started = performance.now();
        let success = false;
        try {
          const result = await request.plugin
            .getMermaid(request.config)
            .render(`sd-mermaid-${++mermaidRenderId}`, request.code);
          if (disposed) return;
          // A successful intermediate layout is useful while the next request runs.
          // A changed plugin/config must never install old executable bindings.
          if (
            request.plugin === untrack(diagram) &&
            request.config === context.mermaid?.config
          ) {
            batch(() => {
              setSvg(sanitizeMermaid(result.svg));
              setBinding(
                () =>
                  (
                    result as {
                      bindFunctions?: (el: globalThis.Element) => void;
                    }
                  ).bindFunctions,
              );
              setError("");
            });
            success = true;
          }
        } catch (cause) {
          if (!disposed && request.revision === revision)
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        // Yield the layout's elapsed time while streaming, but final fence closure
        // and explicit retry wake the loop immediately (even with unchanged code).
        if (success && untrack(isIncomplete) && !disposed) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              wake = undefined;
              resolve();
            }, performance.now() - started);
            wake = () => {
              clearTimeout(timer);
              wake = undefined;
              resolve();
            };
          });
        }
      }
    } finally {
      inFlight = false;
    }
  };
  createEffect(() => {
    const attempt = retry();
    if (attempt) wake?.();
    const block = source();
    const plugin = diagram();
    const config = context.mermaid?.config;
    const incomplete = isIncomplete();
    const visible = ready();
    const custom = renderer();
    ++revision;
    if (!plugin || custom || isServer) {
      pending = undefined;
      wake?.();
      setSvg("");
      setBinding(undefined);
      setError("");
      return;
    }
    pending = { plugin, config, code: block.code, revision };
    setError("");
    if (!incomplete) wake?.();
    if (visible) void drain();
  });
  return (
    <Show
      when={renderer()}
      fallback={
        <Show
          when={diagram()}
          fallback={
            <CodeBlock
              {...props.hostProps}
              code={source().code}
              language={source().language}
              isIncomplete={isIncomplete()}
              startLine={Math.max(
                1,
                Number(source().meta?.match(/startLine=(\d+)/)?.[1] ?? 1),
              )}
              lineNumbers={
                /\bnoLineNumbers\b/.test(source().meta ?? "")
                  ? false
                  : context.lineNumbers
              }
            >
              <Show when={control("code", "copy")()}>
                <CodeBlockCopyButton
                  onCopy={() => {
                    const config =
                      typeof context.controls === "object"
                        ? context.controls.code
                        : undefined;
                    if (
                      typeof config === "object" &&
                      typeof config.copy === "object"
                    )
                      config.copy.onCopy?.();
                  }}
                  onError={(error: Error) => {
                    const config =
                      typeof context.controls === "object"
                        ? context.controls.code
                        : undefined;
                    if (
                      typeof config === "object" &&
                      typeof config.copy === "object"
                    )
                      config.copy.onError?.(error);
                  }}
                />
              </Show>
              <Show when={control("code", "download")()}>
                <CodeBlockDownloadButton language={source().language} />
              </Show>
            </CodeBlock>
          }
        >
          <Suspense fallback={<CodeBlockSkeleton />}>
            <div
              ref={setContainer}
              data-streamdown="mermaid"
              dir="ltr"
              aria-busy={!svg() && !error()}
            >
              <Show
                when={svg()}
                fallback={
                  <Show when={!error()}>
                    <Show
                      when={!isServer}
                      fallback={
                        <pre>
                          <code>{source().code}</code>
                        </pre>
                      }
                    >
                      <Show
                        when={ready()}
                        fallback={
                          <div
                            class={cn("my-4 min-h-[200px]")}
                            style={{ "min-height": "200px" }}
                          />
                        }
                      >
                        <div
                          role="status"
                          class={cn("my-4 flex justify-center p-4")}
                        >
                          <div
                            class={cn(
                              "flex items-center space-x-2 text-muted-foreground",
                            )}
                          >
                            <div
                              aria-hidden="true"
                              class={cn(
                                "h-4 w-4 animate-spin rounded-full border-current border-b-2",
                              )}
                            />
                            <span class={cn("text-sm")}>
                              Loading diagram...
                            </span>
                          </div>
                        </div>
                      </Show>
                    </Show>
                  </Show>
                }
              >
                <MermaidDiagram
                  chart={source().code}
                  svg={svg()}
                  bindFunctions={binding()}
                  showControls={!!control("mermaid", "panZoom")()}
                />
              </Show>
              <Show when={svg()}>
                <MermaidControls
                  chart={source().code}
                  svg={svg()}
                  bindFunctions={binding()}
                />
              </Show>
              <Show when={error() && !svg()}>
                <Show
                  when={context.mermaid?.errorComponent}
                  fallback={
                    <div role="alert" class={cn("rounded-md bg-red-50 p-4")}>
                      <p class={cn("font-mono text-red-700 text-sm")}>
                        Mermaid Error: {error()}
                      </p>
                      <details class={cn("mt-2")}>
                        <summary
                          class={cn("cursor-pointer text-red-600 text-xs")}
                        >
                          Show Code
                        </summary>
                        <pre
                          class={cn(
                            "mt-2 overflow-x-auto rounded bg-red-100 p-2 text-red-800 text-xs",
                          )}
                        >
                          {source().code}
                        </pre>
                      </details>
                    </div>
                  }
                >
                  {(ErrorComponent) => (
                    <Dynamic
                      component={ErrorComponent()}
                      chart={source().code}
                      error={error()}
                      retry={() => setRetry((value) => value + 1)}
                    />
                  )}
                </Show>
              </Show>
            </div>
          </Suspense>
        </Show>
      }
    >
      {(custom) => (
        <Suspense fallback={<CodeBlockSkeleton />}>
          <Dynamic
            component={custom().component}
            code={source().code}
            language={source().language}
            meta={source().meta}
            isIncomplete={isIncomplete()}
          />
        </Suspense>
      )}
    </Show>
  );
}
