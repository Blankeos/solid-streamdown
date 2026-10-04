import {
  Index,
  Show,
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  useContext,
} from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import DOMPurify from "dompurify";
import type { Element } from "hast";
import type { StreamdownProps } from "./types";
import type { BundledLanguage } from "shiki";
import type { HighlightResult } from "./plugin-types";

export const FeatureContext = createContext<StreamdownProps>();

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
export function FeatureBlock(props: { element: () => Element }) {
  const context = useContext(FeatureContext)!;
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
  const [highlighted, setHighlighted] = createSignal<HighlightResult>();
  const [svg, setSvg] = createSignal("");
  const [error, setError] = createSignal("");
  const id = createUniqueId().replace(/[^a-zA-Z0-9_-]/g, "");
  let revision = 0;
  createEffect(() => {
    const current = ++revision;
    const block = source();
    const plugin = context.plugins?.code;
    const mermaid = diagram();
    const config = context.mermaid?.config;
    const themes = context.shikiTheme ?? plugin?.getThemes();
    const incomplete =
      context.mode !== "static" && (context.isAnimating ?? false);
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    setHighlighted(undefined);
    setSvg("");
    setError("");
    if (renderer()) return;
    if (mermaid) {
      if (isServer) return;
      // A new id for each request prevents concurrent Mermaid renders sharing a container.
      Promise.resolve()
        .then(() => {
          if (cancelled) return;
          return mermaid
            .getMermaid(config)
            .render(`sd-${id}-${current}`, block.code);
        })
        .then((result) => {
          if (!cancelled && result)
            setSvg(
              DOMPurify.sanitize(result.svg, {
                USE_PROFILES: { html: true, svg: true, svgFilters: true },
                ADD_TAGS: ["foreignObject"],
                HTML_INTEGRATION_POINTS: { foreignobject: true },
              }),
            );
        })
        .catch((cause: unknown) => {
          if (!cancelled)
            setError(cause instanceof Error ? cause.message : String(cause));
        });
    } else if (plugin && themes) {
      const accept = (result: HighlightResult) => {
        if (!cancelled) setHighlighted(result);
      };
      const result = plugin.highlight(
        {
          code: block.code,
          language: block.language as BundledLanguage,
          themes,
          isIncomplete: incomplete,
        },
        accept,
      );
      if (result) accept(result);
    }
  });
  return (
    <Show
      when={renderer()}
      fallback={
        <Show
          when={diagram()}
          fallback={
            <pre
              dir="ltr"
              data-streamdown="code-block"
              class="sd-code"
              style={highlighted()?.rootStyle || undefined}
            >
              <code class={`language-${source().language}`}>
                <Show when={highlighted()} fallback={source().code}>
                  {(result) => (
                    <Index each={result().tokens}>
                      {(line, lineIndex) => (
                        <>
                          <span
                            class="sd-code-line"
                            data-line={
                              context.lineNumbers === false
                                ? undefined
                                : lineIndex + 1
                            }
                          >
                            <Index each={line()}>
                              {(token) => (
                                <span
                                  {...token().htmlAttrs}
                                  style={{
                                    color: token().color,
                                    "background-color": token().bgColor,
                                    ...token().htmlStyle,
                                  }}
                                >
                                  {token().content}
                                </span>
                              )}
                            </Index>
                          </span>
                          {lineIndex < result().tokens.length - 1 ? "\n" : ""}
                        </>
                      )}
                    </Index>
                  )}
                </Show>
              </code>
            </pre>
          }
        >
          <div
            data-streamdown="mermaid"
            dir="ltr"
            aria-busy={!svg() && !error()}
          >
            <Show
              when={svg()}
              fallback={
                <pre>
                  <code>{source().code}</code>
                </pre>
              }
            >
              <div innerHTML={svg()} />
            </Show>
            <Show when={error() && !context.isAnimating}>
              <p role="alert">{error()}</p>
            </Show>
          </div>
        </Show>
      }
    >
      {(custom) => (
        <Dynamic
          component={custom().component}
          code={source().code}
          language={source().language}
          meta={source().meta}
          isIncomplete={
            context.mode !== "static" && (context.isAnimating ?? false)
          }
        />
      )}
    </Show>
  );
}
