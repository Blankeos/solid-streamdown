import { describe, expect, it } from "vitest";
import type { Element, Root, RootContent } from "hast";
import { parseMarkdownTree } from "../src/parser";
import {
  MAX_ANIMATION_BACKLOG_MS,
  createAnimatePlugin,
  createAnimateTimeline,
} from "../src/animate-plugin";

const apply = (markdown: string, plugin = createAnimatePlugin()) => {
  const tree = parseMarkdownTree(markdown);
  plugin.rehypePlugin()(tree);
  return { tree, plugin };
};

const collectElements = (root: Root, tagName: string): Element[] => {
  const found: Element[] = [];
  const walk = (nodes: RootContent[] | Element["children"]) => {
    for (const node of nodes) {
      if (node.type !== "element") {
        continue;
      }
      if (node.tagName === tagName) {
        found.push(node);
      }
      walk(node.children);
    }
  };
  walk(root.children);
  return found;
};

const animateSpans = (root: Root): Element[] =>
  collectElements(root, "span").filter(
    (el) => el.properties?.["data-sd-animate"] != null,
  );

const textOf = (root: Root): string => {
  let out = "";
  const walk = (nodes: RootContent[] | Element["children"]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        out += node.value;
      } else if (node.type === "element") {
        walk(node.children);
      }
    }
  };
  walk(root.children);
  return out;
};

const styleOf = (el: Element): string =>
  typeof el.properties?.style === "string" ? el.properties.style : "";

describe("createAnimatePlugin", () => {
  it("wraps visible words separately from their timed whitespace", () => {
    const { tree } = apply("Hello world");
    const spans = animateSpans(tree);
    expect(
      spans.map((s) => textOf({ type: "root", children: [s] } as Root)),
    ).toEqual(["Hello", "world"]);
    expect(textOf(tree)).toBe("Hello world");
  });

  it("leaves whitespace-only text untouched", () => {
    const tree = parseMarkdownTree("   ");
    createAnimatePlugin().rehypePlugin()(tree);
    expect(animateSpans(tree)).toHaveLength(0);
  });

  it("splits characters with grapheme awareness and separates spaces", () => {
    const plugin = createAnimatePlugin({ sep: "char" });
    const { tree } = apply("Hi there", plugin);
    const spans = animateSpans(tree);
    // H, i, t, h, e, r, e; the space shares i's timing.
    expect(spans[0].children[0]).toMatchObject({ value: "H" });
    expect(spans[1].children[0]).toMatchObject({ value: "i" });
    expect(textOf(tree)).toBe("Hi there");
  });

  it.each(["word", "char"] as const)(
    "%s whitespace preserves text and source offsets without spending schedule slots",
    (sep) => {
      // Unlike the browser geometry regression, this guards the plugin's source
      // identity and timeline contract: splitting a space must not add a reveal
      // slot, split a grapheme, or lose progress during a source-preserving rewrite.
      let now = 0;
      const timeline = createAnimateTimeline({ now: () => now });
      const plugin = createAnimatePlugin({
        sep,
        timeline,
        animation: "customTransform",
        duration: 300,
        easing: "linear",
      });
      const text = "  👩‍💻 \n e\u0301  end\t";
      const makeTree = (value = text): Root => ({
        type: "root",
        children: [
          {
            type: "element",
            tagName: "a",
            properties: { href: "/" },
            children: [
              {
                type: "text",
                value,
                position: {
                  start: { line: 1, column: 101, offset: 100 },
                  end: { line: 2, column: 1, offset: 100 + value.length },
                },
              },
            ],
          },
        ],
      });
      const expectedTokens =
        sep === "word"
          ? ["👩‍💻", "e\u0301", "end"]
          : ["👩‍💻", "e\u0301", "e", "n", "d"];
      const expectedOffsets =
        sep === "word" ? [2, 10, 14] : [2, 10, 14, 15, 16];
      const assertTree = (tree: Root, value = text) => {
        const visible = animateSpans(tree);
        expect(
          visible.map((span) => textOf({ type: "root", children: [span] })),
        ).toEqual(
          value === text
            ? expectedTokens
            : [
                ...expectedTokens,
                ...(sep === "word" ? ["next"] : ["n", "e", "x", "t"]),
              ],
        );
        expect(
          visible
            .slice(0, expectedTokens.length)
            .map((span) => span.properties["data-sd-offset"]),
        ).toEqual(expectedOffsets);
        expect(
          visible
            .slice(0, expectedTokens.length)
            .map((span) => span.properties["data-sd-key"]),
        ).toEqual(expectedOffsets.map((offset) => `source:${100 + offset}`));
        const spaces = collectElements(tree, "span").filter(
          (span) => span.properties["data-sd-animate-space"] != null,
        );
        expect(
          spaces.map((span) => textOf({ type: "root", children: [span] })),
        ).toEqual([" \n ", "  ", "\t"]);
        expect(spaces.map((span) => span.properties["data-sd-offset"])).toEqual(
          [7, 12, 17],
        );
        expect(spaces.map((span) => span.properties["data-sd-key"])).toEqual([
          "source:107:space",
          "source:112:space",
          "source:117:space",
        ]);
        const children = collectElements(tree, "a")[0].children;
        for (const space of spaces) {
          expect(space.properties["data-sd-animate"]).toBeUndefined();
          const preceding = children[children.indexOf(space) - 1] as Element;
          expect(styleOf(preceding)).toContain(
            "--sd-animation:sd-customTransform",
          );
          expect(styleOf(space)).toBe(
            styleOf(preceding).replace("sd-customTransform", "sd-fadeIn"),
          );
          expect(space.properties["data-sd-animation-session"]).toBe(
            preceding.properties["data-sd-animation-session"],
          );
        }
        expect(textOf(tree)).toBe(value);
        expect(plugin.getLastRenderCharCount()).toBe(value.length);
        return visible;
      };
      timeline.beginPass(now);
      const first = makeTree();
      plugin.rehypePlugin()(first);
      assertTree(first);
      expect(timeline.mark()).toBe(expectedTokens.length * 40);
      timeline.commitPass();
      plugin.commit();

      now = 20;
      timeline.beginPass(now);
      const appended = makeTree(text + "next");
      plugin.rehypePlugin()(appended);
      const visible = assertTree(appended, text + "next");
      expect(styleOf(visible[0])).toContain("--sd-delay:-20ms");
      expect(styleOf(visible[expectedTokens.length])).toContain(
        `--sd-delay:${expectedTokens.length * 40 - now}ms`,
      );
      expect(timeline.mark()).toBe(
        (expectedTokens.length + (sep === "word" ? 1 : 4)) * 40,
      );
      timeline.commitPass();
      plugin.commit();

      now = 1000;
      timeline.beginPass(now);
      const settled = makeTree(text + "next");
      plugin.rehypePlugin()(settled);
      assertTree(settled, text + "next");
      for (const span of collectElements(settled, "span")) {
        expect(styleOf(span)).toContain("--sd-duration:0ms");
      }
      expect(timeline.mark()).toBe(now);
    },
  );

  it("animates inline code but skips pre, svg, math, and annotation", () => {
    const { tree } = apply("Hello `world` foo");
    const code = collectElements(tree, "code")[0];
    expect(code).toBeTruthy();
    expect(
      collectElements(
        { type: "root", children: [code] } as Root,
        "span",
      ).filter((s) => s.properties?.["data-sd-animate"] != null).length,
    ).toBeGreaterThan(0);

    const fenced = parseMarkdownTree("```js\nconst x = 1;\n```");
    createAnimatePlugin().rehypePlugin()(fenced);
    expect(animateSpans(fenced)).toHaveLength(0);

    for (const tagName of ["svg", "math", "annotation"]) {
      const hostTree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName,
            properties: {},
            children: [{ type: "text", value: "label" }],
          },
        ],
      };
      createAnimatePlugin().rehypePlugin()(hostTree);
      expect(animateSpans(hostTree)).toHaveLength(0);
    }
  });

  it("applies custom animation, duration, easing, and stagger delays", () => {
    const plugin = createAnimatePlugin({
      animation: "customReveal",
      duration: 300,
      easing: "ease-out",
      stagger: 50,
    });
    const { tree } = apply("Hello world foo", plugin);
    const spans = animateSpans(tree);
    expect(spans).toHaveLength(3);
    for (const span of spans) {
      expect(styleOf(span)).toContain("sd-customReveal");
      expect(styleOf(span)).toContain("300ms");
      expect(styleOf(span)).toContain("ease-out");
    }
    // First word has no delay; later words stagger.
    expect(styleOf(spans[0])).not.toContain("--sd-delay");
    expect(styleOf(spans[1])).toContain("--sd-delay:50ms");
    expect(styleOf(spans[2])).toContain("--sd-delay:100ms");
  });

  it("uses fadeIn, 150ms, and ease by default", () => {
    const { tree } = apply("Hello");
    const [span] = animateSpans(tree);
    expect(styleOf(span)).toContain("sd-fadeIn");
    expect(styleOf(span)).toContain("150ms");
    expect(styleOf(span)).toContain("ease");
  });

  it("reuses stable offsets with full duration across commits instead of zeroing", () => {
    // Continuity: prefix offsets stable, in-flight reveals continue (full
    // duration) instead of aborting to 0ms every ~20ms (no visible reveal).
    // Credible failure: zeroing prefix to `--sd-duration:0ms` aborts the tail
    // 20ms later; naive text-keyed caches collide on repeats. No other test
    // covers plugin-level offset stability (renderer tests cover DOM freeze).
    const plugin = createAnimatePlugin();
    const first = parseMarkdownTree("Hello");
    plugin.rehypePlugin()(first);
    plugin.commit();

    const second = parseMarkdownTree("Hello world");
    plugin.rehypePlugin()(second);
    const spans = animateSpans(second);
    const styles = spans.map((s) => styleOf(s));
    // Never zeroed — settled + new both run full reveal to opacity 1.
    for (const style of styles) {
      expect(style).toMatch(/--sd-duration:\s*150ms/);
      expect(style).not.toMatch(/--sd-duration:\s*0ms/);
    }
    // Stable logical offsets (not text) for renderer freeze.
    const offsets = spans.map((s) => s.properties?.["data-sd-offset"]);
    expect(offsets).toEqual([0, 6]);
    expect(plugin.getLastRenderCharCount()).toBeGreaterThan(5);
  });

  it("tags images and rules with timing and preserves existing styles", () => {
    const { tree } = apply("![alt](x.png)\n\n---");
    const images = collectElements(tree, "img");
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].properties?.["data-sd-animate"]).toBe(true);
    expect(styleOf(images[0])).toContain("sd-fadeIn");
  });

  it("syncs list markers and task checkboxes with their item's first word", () => {
    const { tree } = apply("- Hello world\n- [ ] Task item");
    const items = collectElements(tree, "li");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.properties?.["data-sd-animate-marker"]).toBe(true);
    }
    const inputs = collectElements(tree, "input");
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs[0].properties?.["data-sd-animate"]).toBe(true);
  });

  it("bounds late-token delays on a shared wall-clock timeline", () => {
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ timeline });
    timeline.beginPass(now);
    const first = parseMarkdownTree("Hello world");
    plugin.rehypePlugin()(first);
    timeline.commitPass();
    plugin.commit();
    now += 50;
    timeline.beginPass(now);
    const many = parseMarkdownTree(
      Array.from({ length: 60 }, () => "word").join(" "),
    );
    plugin.rehypePlugin()(many);
    timeline.commitPass();
    const spans = animateSpans(many);
    expect(spans.length).toBeGreaterThan(50);
    const delays = spans.map((s) => {
      const m = styleOf(s).match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    // 59*40=2360ms absolute would leave seconds of invisible queue.
    expect(Math.max(...delays)).toBeLessThanOrEqual(
      MAX_ANIMATION_BACKLOG_MS + 80,
    );
  });

  it("preserves in-flight prefix timing across appends for continuity", () => {
    // In-flight 450ms/150ms reveals must continue (same delay reuse) while
    // new tail starts fresh — aborting to 0ms every 20ms leaves no visible
    // reveal. Credible failure: zeroing prefix + recomputing delays restarts
    // CSS animations. Renderer DOM-freeze tests cannot catch plugin-level
    // delay reuse without this owner.
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ timeline });
    timeline.beginPass(now);
    const first = parseMarkdownTree("Hello world");
    plugin.rehypePlugin()(first);
    timeline.commitPass();
    plugin.commit();
    now += 20;
    timeline.beginPass(now);
    const second = parseMarkdownTree("Hello world foo bar");
    plugin.rehypePlugin()(second);
    const spans = animateSpans(second);
    // All full duration, never zeroed.
    for (const span of spans) {
      expect(styleOf(span)).toMatch(/--sd-duration:\s*150ms/);
      expect(styleOf(span)).not.toMatch(/--sd-duration:\s*0ms/);
    }
    // Recreated hosts resume the original absolute schedule, including progress.
    expect(styleOf(spans[0])).toContain("--sd-delay:-20ms");
    expect(styleOf(spans[1])).toContain("--sd-delay:20ms");
    expect(spans.some((s) => /--sd-duration:\s*150ms/.test(styleOf(s)))).toBe(
      true,
    );
    // Stable offsets for renderer freeze.
    const offsets = spans.map((s) => s.properties?.["data-sd-offset"]);
    expect(offsets[0]).toBe(0);
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it("keeps custom duration with timeline compression", () => {
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ duration: 300, timeline });
    timeline.beginPass(now);
    const tree = parseMarkdownTree(
      Array.from({ length: 40 }, () => "word").join(" "),
    );
    plugin.rehypePlugin()(tree);
    const spans = animateSpans(tree);
    expect(spans.length).toBeGreaterThan(30);
    for (const span of spans) {
      expect(styleOf(span)).toContain("300ms");
    }
    const delays = spans.map((s) => {
      const m = styleOf(s).match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...delays)).toBeLessThanOrEqual(
      MAX_ANIMATION_BACKLOG_MS + 80,
    );
  });

  it("does not spend backlog budget on skipped fenced code", () => {
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ timeline });
    timeline.beginPass(now);
    const tree = parseMarkdownTree(
      "```js\nconst x = 1;\n```\n\n" +
        Array.from({ length: 50 }, () => "word").join(" "),
    );
    plugin.rehypePlugin()(tree);
    const spans = animateSpans(tree);
    expect(spans.length).toBeGreaterThan(40);
    const delays = spans.map((s) => {
      const m = styleOf(s).match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...delays)).toBeLessThanOrEqual(
      MAX_ANIMATION_BACKLOG_MS + 80,
    );
    const fenced = parseMarkdownTree("```js\nconst x = 1;\n```");
    // Separate run without timeline still leaves fenced blocks untouched.
    createAnimatePlugin().rehypePlugin()(fenced);
    expect(animateSpans(fenced)).toHaveLength(0);
  });

  it("orders list markers with their item's first word under load", () => {
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ timeline });
    timeline.beginPass(now);
    const md = Array.from(
      { length: 30 },
      (_, i) => `- Item ${i} words here`,
    ).join("\n");
    const tree = parseMarkdownTree(md);
    plugin.rehypePlugin()(tree);
    const items = collectElements(tree, "li");
    expect(items.length).toBeGreaterThanOrEqual(30);
    const markerDelays = items.map((li) => {
      const m = styleOf(li).match(/--sd-marker-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...markerDelays)).toBeLessThanOrEqual(
      MAX_ANIMATION_BACKLOG_MS + 180,
    );
    // First marker starts the cascade; later markers never run ahead of it.
    const sorted = [...markerDelays].sort((a, b) => a - b);
    expect(markerDelays).toEqual(sorted);
  });

  it("enforces a hard backlog cap for a 1000-char burst even below the min step", () => {
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ sep: "char", stagger: 8, timeline });
    timeline.beginPass(now);
    // 1000 chars at 8ms stagger would be ~8s absolute; floor 4ms still gives
    // 999*4=3996ms despite the 320ms budget — no seconds of invisible queue.
    const tree = parseMarkdownTree("a".repeat(1000));
    plugin.rehypePlugin()(tree);
    const spans = animateSpans(tree);
    expect(spans.length).toBeGreaterThanOrEqual(900);
    const delays = spans.map((s) => {
      const m = styleOf(s).match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...delays)).toBeLessThanOrEqual(MAX_ANIMATION_BACKLOG_MS);
  });

  it("enforces a hard backlog cap for a 1200-word burst", () => {
    let now = 0;
    const timeline = createAnimateTimeline({ now: () => now });
    const plugin = createAnimatePlugin({ timeline });
    timeline.beginPass(now);
    const tree = parseMarkdownTree(
      Array.from({ length: 1200 }, () => "word").join(" "),
    );
    plugin.rehypePlugin()(tree);
    const spans = animateSpans(tree);
    expect(spans.length).toBeGreaterThanOrEqual(1100);
    const delays = spans.map((s) => {
      const m = styleOf(s).match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    // Floor 4ms would give 1199*4=4796ms; hard cap keeps it within budget.
    expect(Math.max(...delays)).toBeLessThanOrEqual(MAX_ANIMATION_BACKLOG_MS);
  });
});
