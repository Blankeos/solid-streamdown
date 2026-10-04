import { render } from "solid-js/web";
import { FeatureContext } from "../../src/streamdown-context";
import { CodeBlock, CodeBlockCopyButton } from "../../src/code-block";
import { LinkComponent } from "../../src/link";
import type { CodeHighlighterPlugin } from "../../src/plugin-types";
import "../../styles.css";
export function mountThemeParity() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  const provider = (
    dual: boolean,
    rootStyle: boolean,
  ): CodeHighlighterPlugin => ({
    name: "shiki",
    type: "code-highlighter",
    getThemes: () => ["github-light", "github-dark"],
    getSupportedLanguages: () => ["js"],
    supportsLanguage: () => true,
    highlight: () => ({
      bg: "#f1f2f3",
      fg: "#112233",
      rootStyle: rootStyle
        ? "--shiki-dark-bg:#202122;--shiki-dark:#abcdef"
        : undefined,
      tokens: [
        [
          {
            content: "colored",
            color: "#123456",
            bgColor: "#ddeeff",
            htmlStyle: {
              "font-style": "italic",
              "font-weight": "700",
              "text-decoration": "underline",
              ...(dual
                ? { "--shiki-dark": "#aabbcc", "--shiki-dark-bg": "#334455" }
                : {}),
            },
          },
          { content: "plain" },
        ],
      ],
    }),
  });
  return render(
    () => (
      <>
        <button
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          theme
        </button>
        {[
          { dual: false, rootStyle: false },
          { dual: true, rootStyle: true },
          { dual: true, rootStyle: false },
        ].map(({ dual, rootStyle }) => (
          <section data-dual={dual} data-root-style={rootStyle}>
            <FeatureContext.Provider
              value={{
                plugins: { code: provider(dual, rootStyle) },
                prefix: "tw",
              }}
            >
              <CodeBlock code="coloredplain" language="js">
                <CodeBlockCopyButton className="p-2" />
              </CodeBlock>
              <LinkComponent href="https://example.com">external</LinkComponent>
            </FeatureContext.Provider>
          </section>
        ))}
      </>
    ),
    root,
  );
}
