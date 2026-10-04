import { describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";
import { StreamMarkdown, createMarkdownStream } from "../src/index";

const mount = (ui: () => JSX.Element) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = render(ui, container);
  return {
    container,
    dispose,
    cleanup: () => {
      dispose();
      container.remove();
    },
  };
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const animateSpans = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll("[data-sd-animate]")) as HTMLElement[];

describe("StreamMarkdown renderer", () => {
  it("keeps the same word DOM across appends so animations do not replay", async () => {
    const [content, setContent] = createSignal("Hello");
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={content()} animated isAnimating />
    ));
    await flush();

    const first = animateSpans(container)[0];
    expect(first?.textContent).toBe("Hello");

    setContent("Hello world");
    await flush();

    const spans = animateSpans(container);
    expect(spans.map((s) => s.textContent)).toEqual(["Hello ", "world"]);
    // Same paragraph, same first word — appended words get new slots.
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.contains(first)).toBe(true);
    expect(spans[0]).toBe(first);
    cleanup();
  });

  it("renders no animation spans in static mode even when animating", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content="Hello **world"
        mode="static"
        animated
        isAnimating
      />
    ));
    await flush();
    expect(animateSpans(container)).toHaveLength(0);
    // Static mode does not repair incomplete markdown.
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("world");
    cleanup();
  });

  it("removes animation spans when the stream settles without remounting hosts", async () => {
    const [animating, setAnimating] = createSignal(true);
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content="Hello world"
        animated
        isAnimating={animating()}
      />
    ));
    await flush();
    expect(animateSpans(container).length).toBeGreaterThan(0);
    const paragraph = container.querySelector("p");
    expect(paragraph).toBeTruthy();

    setAnimating(false);
    await flush();
    expect(animateSpans(container)).toHaveLength(0);
    expect(container.querySelector("p")).toBe(paragraph);
    expect(container.textContent).toContain("Hello world");
    cleanup();
  });

  it("keeps duplicate blocks independent instead of sharing DOM", async () => {
    const [content, setContent] = createSignal("Hello\n\nHello");
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={content()} animated isAnimating />
    ));
    await flush();

    const paragraphs = Array.from(container.querySelectorAll("p"));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).not.toBe(paragraphs[1]);
    const firstWord = animateSpans(container)[0];

    setContent("Hello\n\nHello world");
    await flush();
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.contains(firstWord)).toBe(true);
    expect(container.textContent).toContain("Hello world");
    cleanup();
  });

  it("preserves reference links and loose lists via full-document parsing", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content={
          "[hello][greet]\n\n[greet]: https://example.com\n\n- a\n\n- b\n"
        }
      />
    ));
    await flush();
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toBe("hello");
    // Loose list items keep their structure instead of collapsing.
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
    cleanup();
  });

  it("repairs incomplete markdown while streaming", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content="Hello **world" animated isAnimating />
    ));
    await flush();
    expect(container.querySelector("strong")).toBeTruthy();
    cleanup();
  });

  it("fires animation callbacks only on transitions and never in static mode", async () => {
    const start = vi.fn();
    const end = vi.fn();
    const [animating, setAnimating] = createSignal(false);
    const { cleanup } = mount(() => (
      <StreamMarkdown
        content="Hello"
        animated
        isAnimating={animating()}
        onAnimationStart={start}
        onAnimationEnd={end}
      />
    ));
    await flush();
    expect(start).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();

    setAnimating(true);
    await flush();
    expect(start).toHaveBeenCalledTimes(1);

    setAnimating(false);
    await flush();
    expect(end).toHaveBeenCalledTimes(1);
    cleanup();

    const staticStart = vi.fn();
    const staticEnd = vi.fn();
    const { cleanup: cleanupStatic } = mount(() => (
      <StreamMarkdown
        content="Hello"
        mode="static"
        animated
        isAnimating
        onAnimationStart={staticStart}
        onAnimationEnd={staticEnd}
      />
    ));
    await flush();
    expect(staticStart).not.toHaveBeenCalled();
    expect(staticEnd).not.toHaveBeenCalled();
    cleanupStatic();
  });

  it("applies custom components and reacts to config changes", async () => {
    const [target, setTarget] = createSignal("_blank");
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content="[link](https://example.com)"
        components={{
          a: (props) => (
            <a {...props} target={target()}>
              {props.children}
            </a>
          ),
        }}
      />
    ));
    await flush();
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");

    setTarget("_self");
    await flush();
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_self");
    cleanup();
  });

  it("supports char splitting, custom animations, and streaming sources", async () => {
    const stream = createMarkdownStream();
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        stream={stream}
        animated={{ animation: "quartaReveal", sep: "char" }}
        class="custom-wrap"
      />
    ));
    await flush();
    expect(container.firstElementChild?.classList.contains("custom-wrap")).toBe(
      true,
    );

    stream.write("Hi");
    await flush();
    // Char mode wraps graphemes; custom animation name flows to CSS vars.
    const spans = animateSpans(container);
    expect(spans.length).toBeGreaterThanOrEqual(2);
    expect(container.innerHTML).toContain("sd-quartaReveal");

    stream.write(" there");
    await flush();
    expect(container.textContent).toBe("Hi there");

    stream.end();
    await flush();
    // Backward compat: wrapper keeps streaming classes only while active.
    expect(
      container.firstElementChild?.classList.contains("streamdown-streaming"),
    ).toBe(false);
    cleanup();
  });

  it("animates inline code but leaves fenced blocks untouched", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content={"Hello `world` foo\n\n```js\nconst x = 1;\n```\n"}
        animated
        isAnimating
      />
    ));
    await flush();
    const inlineCode = container.querySelector("p code");
    expect(inlineCode?.querySelector("[data-sd-animate]")).toBeTruthy();
    const fenced = container.querySelector("pre");
    expect(fenced).toBeTruthy();
    expect(fenced?.querySelector("[data-sd-animate]")).toBeNull();
    cleanup();
  });

  it("preserves punctuation and whitespace exactly", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content="Hello, world!" animated isAnimating />
    ));
    await flush();
    expect(container.textContent).toBe("Hello, world!");
    const spans = animateSpans(container);
    expect(spans.map((s) => s.textContent).join("")).toBe("Hello, world!");
    cleanup();
  });

  it("shows the caret only on the terminal host while streaming", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content="Hello world" animated isAnimating />
    ));
    await flush();
    const hosts = Array.from(
      container.querySelectorAll(".streamdown-caret"),
    ) as HTMLElement[];
    // Only the container carries the caret class — never every descendant.
    expect(hosts).toHaveLength(1);
    expect(hosts[0]).toBe(container.firstElementChild);
    cleanup();
  });

  it("hides the caret when showCaret is false", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content="Hello" isAnimating showCaret={false} />
    ));
    await flush();
    expect(
      container.firstElementChild?.classList.contains("streamdown-caret"),
    ).toBe(false);
    cleanup();
  });

  it("bounds late-token delays instead of growing index*stagger into seconds", async () => {
    const many = Array.from({ length: 60 }, () => "word").join(" ");
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={many} animated isAnimating />
    ));
    await flush();
    const spans = animateSpans(container);
    expect(spans.length).toBeGreaterThan(50);
    const delays = spans.map((s) => {
      const style = s.getAttribute("style") ?? "";
      const m = style.match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    const maxDelay = Math.max(...delays);
    // 59*40=2360ms pre-fix (seconds of invisible queue); wall-clock caps ~320ms.
    expect(maxDelay).toBeLessThanOrEqual(400);
    cleanup();
  });

  it("preserves in-flight prefix timing without remounting so appends animate fresh", async () => {
    // Continuity: same DOM, in-flight 150ms reveals continue (frozen style)
    // while new tail starts fresh. Zeroing to 0ms would abort every tail
    // after ~20ms (no visible reveal); text-keyed preservation would collide
    // on repeats. Plain-paragraph owner (word mode); char/rich owners differ.
    const [content, setContent] = createSignal("Hello world");
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={content()} animated isAnimating />
    ));
    await flush();
    await flush();
    const firstBefore = animateSpans(container)[0];
    const beforeOffset = firstBefore?.getAttribute("data-sd-offset");
    expect(firstBefore?.getAttribute("style")).toMatch(/--sd-duration:\s*150ms/);
    expect(beforeOffset).toBe("0");
    setContent("Hello world foo bar baz qux quux corge grault garply");
    await flush();
    await flush();
    const spans = animateSpans(container);
    expect(spans.length).toBeGreaterThan(2);
    // Same DOM (no remount/replay); stable prefix keeps mount timing so its
    // CSS animation continues instead of aborting to 0ms.
    expect(spans[0]).toBe(firstBefore);
    expect(spans[0]?.getAttribute("data-sd-key")).toBeTruthy();
    expect(spans[0]?.getAttribute("data-sd-offset")).toBe(beforeOffset);
    for (const span of spans) {
      expect(span?.getAttribute("style") ?? "").toMatch(
        /--sd-duration:\s*150ms/,
      );
      expect(span?.getAttribute("style") ?? "").not.toMatch(
        /--sd-duration:\s*0ms/,
      );
      expect(span?.hasAttribute("data-sd-offset")).toBe(true);
    }
    // New tail animates fresh with bounded delays (59*40 would be seconds).
    const delays = spans.map((s) => {
      const m = (s.getAttribute("style") ?? "").match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...delays)).toBeLessThanOrEqual(400);
    cleanup();
  });

  it("preserves Quarta char reveal without remounting across appends", async () => {
    // Char-mode owner with custom `quartaReveal` (450ms/8ms): same DOM,
    // in-flight reveal continues (currentTime advances in browser), new chars
    // start fresh. Zeroing would abort each 450ms reveal after ~20ms (user
    // sees no reveal). No other test covers char granularity + custom
    // keyframes + cleanup without remount.
    const quarta = {
      animation: "quartaReveal",
      duration: 450,
      easing: "ease-in-out",
      sep: "char" as const,
      stagger: 8,
      maxBacklogMs: 320,
    };
    const [content, setContent] = createSignal("Hello");
    const [animating, setAnimating] = createSignal(true);
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content={content()}
        animated={quarta}
        isAnimating={animating()}
      />
    ));
    await flush();
    await flush();
    const first = animateSpans(container)[0];
    expect(first?.getAttribute("style")).toMatch(/--sd-duration:\s*450ms/);
    expect(first?.getAttribute("data-sd-offset")).toBe("0");
    const paragraph = container.querySelector("p");
    expect(paragraph).toBeTruthy();

    setContent("Hello world streaming");
    await flush();
    await flush();
    const spans = animateSpans(container);
    expect(spans.length).toBeGreaterThan(1);
    // Old DOM identity survives (no remount/replay); in-flight 450ms timing
    // frozen so the reveal runs to opacity 1 instead of aborting to 0ms.
    expect(spans[0]).toBe(first);
    expect(spans[0]?.getAttribute("data-sd-key")).toBeTruthy();
    for (const span of spans) {
      expect(span?.getAttribute("style") ?? "").toMatch(
        /--sd-duration:\s*450ms/,
      );
      expect(span?.getAttribute("style") ?? "").not.toMatch(
        /--sd-duration:\s*0ms/,
      );
    }
    // New slots animate fresh with the same reveal and bounded delays.
    const lastStyle = spans[spans.length - 1]?.getAttribute("style") ?? "";
    expect(lastStyle).toMatch(/--sd-duration:\s*450ms/);
    const delays = spans.map((s) => {
      const m = (s.getAttribute("style") ?? "").match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...delays)).toBeLessThanOrEqual(400);
    // Completed stream still cleans up spans without remounting hosts.
    setAnimating(false);
    await flush();
    expect(animateSpans(container)).toHaveLength(0);
    expect(container.querySelector("p")).toBe(paragraph);
    expect(container.textContent).toContain("Hello world streaming");
    cleanup();
  });

  it("keeps equivalent animated option objects on the same timeline", async () => {
    const [content, setContent] = createSignal("Hello world");
    const { container, cleanup } = mount(() => (
      // New object identity each render, same values — must not reset to fresh.
      <StreamMarkdown
        content={content()}
        animated={{ animation: "fadeIn" }}
        isAnimating
      />
    ));
    await flush();
    await flush();
    setContent("Hello world foo bar");
    await flush();
    await flush();
    const spans = animateSpans(container);
    expect(spans.length).toBeGreaterThan(2);
    // Stable prefix keeps mount timing (same DOM, full reveal); appended
    // words continue the shared cascade with fresh timing. Zeroing would
    // abort in-flight reveals; fresh timelines would restart delays at 0.
    expect(spans[0]?.getAttribute("data-sd-key")).toBeTruthy();
    for (const span of spans) {
      expect(span?.getAttribute("style") ?? "").toMatch(
        /--sd-duration:\s*150ms/,
      );
    }
    // Timeline persisted: appended words continue the cascade instead of
    // restarting at zero delay as a fresh timeline would.
    const delays = spans.map((s) => {
      const m = (s.getAttribute("style") ?? "").match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...delays)).toBeGreaterThan(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(400);
    cleanup();
  });

  it("starts fresh after end/restart without inheriting previous stream count", async () => {
    const [content, setContent] = createSignal(
      Array.from({ length: 30 }, () => "alpha").join(" "),
    );
    const [animating, setAnimating] = createSignal(true);
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={content()} animated isAnimating={animating()} />
    ));
    await flush();
    await flush();
    setAnimating(false);
    await flush();
    expect(animateSpans(container)).toHaveLength(0);
    const fresh = Array.from({ length: 60 }, () => "word").join(" ");
    setContent(fresh);
    setAnimating(true);
    await flush();
    await flush();
    const spans = animateSpans(container);
    expect(spans.length).toBeGreaterThan(50);
    const delays = spans.map((s) => {
      const m = (s.getAttribute("style") ?? "").match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    // Fresh stream bounds its own cascade; inheriting the old horizon would push past backlog.
    expect(Math.max(...delays)).toBeLessThanOrEqual(400);
    // New prefix animates (150ms), not entirely settled as inherited old would be.
    expect(
      spans.some((s) =>
        /--sd-duration:\s*150ms/.test(s.getAttribute("style") ?? ""),
      ),
    ).toBe(true);
    // Backtrack to a short prefix restarts fresh instead of staying settled.
    setContent("Hi");
    await flush();
    await flush();
    const backtracked = animateSpans(container);
    expect(backtracked.length).toBeGreaterThan(0);
    expect(backtracked[0]?.getAttribute("style") ?? "").toMatch(
      /--sd-duration:\s*150ms/,
    );
    cleanup();
  });

  it("skips fenced code and orders list markers with their first word", async () => {
    const items = Array.from(
      { length: 30 },
      (_, i) => `- Item ${i} words here`,
    ).join("\n");
    const md = `${items}\n\n- [ ] Task item words here\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n`;
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={md} animated isAnimating />
    ));
    await flush();
    const fenced = container.querySelector("pre");
    expect(fenced).toBeTruthy();
    expect(fenced?.querySelector("[data-sd-animate]")).toBeNull();
    const listItems = Array.from(container.querySelectorAll("li"));
    expect(listItems.length).toBeGreaterThanOrEqual(30);
    for (const item of listItems) {
      expect(item.hasAttribute("data-sd-animate-marker")).toBe(true);
    }
    const input = container.querySelector("input");
    expect(input?.hasAttribute("data-sd-animate")).toBe(true);
    // Marker cascade stays bounded; absolute index*40 would push late markers into seconds.
    const markerDelays = listItems.map((li) => {
      const m = (li.getAttribute("style") ?? "").match(
        /--sd-marker-delay:\s*(\d+)ms/,
      );
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...markerDelays)).toBeLessThanOrEqual(500);
    cleanup();
  });

  it("preserves rich prefix across structural appends without scattered re-animation", async () => {
    // Regression for disappearing rich stream text (tables/code/nested
    // formats): while streaming, scattered prefix chars held stale in-flight
    // opacity 0 (only isolated letters visible like Sal/45/00.0) and restored
    // after settle. Stable offsets + frozen full timing keep prefix reveals
    // running to opacity 1 on the same DOM; zeroing would abort each new
    // tail after ~20ms (no visible reveal). No other test covers rich
    // structural appends (headings/tables/nested bold/inline code/links);
    // word/char prefix tests use plain paragraphs.
    // Observable: same span DOM, preserved 450ms timing (frozen style),
    // stable offsets, bounded tail delays. Credible failure: zeroing prefix
    // to 0ms, or text-keyed preservation colliding on repeats ("Salary",
    // "45", "00").
    const quarta = {
      animation: "quartaReveal",
      duration: 450,
      easing: "ease-in-out",
      sep: "char" as const,
      stagger: 8,
      maxBacklogMs: 320,
    };
    const prefix =
      "# Salary Summary\n\nSalary for **April 2025** is $45,000.00 with `bonus` on 2025-04-30.\n";
    const full =
      `${prefix}\nDetails with **bold and \`code\` inside** plus a [pay stub](https://example.com/stub).\n\n` +
      `| Name | Amount |\n| --- | ---: |\n| Salary Apr | 45000.00 |\n\n\`\`\`ts\nconst salary = 45000.00;\n\`\`\`\n`;
    const [content, setContent] = createSignal(prefix);
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={content()} animated={quarta} isAnimating />
    ));
    await flush();
    await flush();
    const beforeSpans = animateSpans(container);
    expect(beforeSpans.length).toBeGreaterThan(10);
    const heading = container.querySelector("h1");
    expect(heading?.textContent).toContain("Salary Summary");
    const beforeOffsets = beforeSpans.map((s) =>
      s.getAttribute("data-sd-offset"),
    );

    setContent(full);
    await flush();
    await flush();
    const afterSpans = animateSpans(container);
    expect(afterSpans.length).toBeGreaterThan(beforeSpans.length);
    // Prefix reuses the same DOM (no remount/replay) for every shared slot.
    for (let i = 0; i < beforeSpans.length; i += 1) {
      expect(afterSpans[i]).toBe(beforeSpans[i]);
    }
    // Stable rich prefix keeps mount timing (frozen, full 450ms) — no
    // scattered 0ms abort and no stale-delay restart among heading/salary.
    for (let i = 0; i < beforeSpans.length; i += 1) {
      expect(afterSpans[i]?.getAttribute("data-sd-key")).toBe(
        beforeSpans[i]?.getAttribute("data-sd-key"),
      );
      expect(afterSpans[i]?.getAttribute("style") ?? "").toMatch(
        /--sd-duration:\s*450ms/,
      );
      expect(afterSpans[i]?.getAttribute("data-sd-offset")).toBe(
        beforeOffsets[i],
      );
    }
    // Offsets unique (no text-keyed collision on repeats like Salary/45/00).
    const allOffsets = afterSpans.map((s) => s.getAttribute("data-sd-offset"));
    expect(new Set(allOffsets).size).toBe(allOffsets.length);
    // New tail (table/link) animates fresh with the same reveal, bounded.
    const tailDelays = afterSpans.slice(beforeSpans.length).map((s) => {
      const m = (s.getAttribute("style") ?? "").match(/--sd-delay:\s*(\d+)ms/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...tailDelays)).toBeLessThanOrEqual(400);
    // Structure intact: table scrolls, link safe, fenced code untouched.
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.com/stub",
    );
    const fenced = container.querySelector("pre");
    expect(fenced?.querySelector("[data-sd-animate]")).toBeNull();
    expect(container.textContent).toContain("45000.00");
    cleanup();
  });

  it("resets the transition when switching static back to streaming", async () => {
    const start = vi.fn();
    const end = vi.fn();
    const [mode, setMode] = createSignal<"streaming" | "static">("streaming");
    const { cleanup } = mount(() => (
      <StreamMarkdown
        content="Hello"
        animated
        isAnimating
        mode={mode()}
        onAnimationStart={start}
        onAnimationEnd={end}
      />
    ));
    await flush();
    expect(start).toHaveBeenCalledTimes(1);
    setMode("static");
    await flush();
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    setMode("streaming");
    await flush();
    // Static must reset prev so returning to streaming fires start again.
    expect(start).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("serializes array token attributes with spaces via property-information", async () => {
    const relArrayPlugin = () => (tree: any) => {
      const walk = (nodes: any[]) => {
        for (const node of nodes) {
          if (node.type !== "element") continue;
          if (node.tagName === "a") {
            node.properties = {
              ...(node.properties ?? {}),
              rel: ["noopener", "noreferrer"],
            };
          }
          if (node.children) walk(node.children);
        }
      };
      walk(tree.children);
    };
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content="[link](https://example.com)"
        rehypePlugins={[relArrayPlugin]}
      />
    ));
    await flush();
    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    // Space-separated per HTML spec; comma-joined "noopener,noreferrer" is invalid.
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    cleanup();
  });

  it("maps table cell align to text-align style for React parity", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content={"| a | b |\n| :-: | --- |\n| c | d |\n"} />
    ));
    await flush();
    const header = container.querySelector("th");
    expect(header).toBeTruthy();
    // hast-util-to-jsx-runtime converts td/th align to style; parity keeps it.
    expect(header?.hasAttribute("align")).toBe(false);
    expect(header?.getAttribute("style") ?? "").toMatch(/text-align:\s*center/);
    const cell = container.querySelector("td");
    expect(cell?.hasAttribute("align")).toBe(false);
    expect(cell?.getAttribute("style") ?? "").toMatch(/text-align:\s*center/);
    cleanup();
  });

  it("leaves incomplete markdown raw by default without an active stream", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content="Hello **world" />
    ));
    await flush();
    // Default follows effectiveIsAnimating (false here), preserving prior
    // completed-string behavior instead of repairing like streaming mode.
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("world");
    cleanup();
  });

  it("unrepairs after stream.end by default but repairs with explicit opt-in", async () => {
    const stream = createMarkdownStream();
    const { container, cleanup } = mount(() => (
      <StreamMarkdown stream={stream} />
    ));
    await flush();
    stream.write("Hello **world");
    await flush();
    // While streaming (effectiveIsAnimating true) incomplete repairs.
    expect(container.querySelector("strong")).toBeTruthy();
    stream.end();
    await flush();
    // Default follows effectiveIsAnimating (false after end) so final is raw.
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("world");
    cleanup();

    const opted = createMarkdownStream();
    const { container: repaired, cleanup: cleanupOpted } = mount(() => (
      <StreamMarkdown stream={opted} parseIncompleteMarkdown />
    ));
    await flush();
    opted.write("Hello **world");
    await flush();
    expect(repaired.querySelector("strong")).toBeTruthy();
    opted.end();
    await flush();
    // Explicit true keeps React-parity repaired final in streaming mode.
    expect(repaired.querySelector("strong")).toBeTruthy();
    cleanupOpted();
  });

  it("never repairs in static mode even with explicit opt-in", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown
        content="Hello **world"
        mode="static"
        parseIncompleteMarkdown
      />
    ));
    await flush();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("world");
    cleanup();
  });

  it("repairs when explicitly opted in without animating (React parity)", async () => {
    const { container, cleanup } = mount(() => (
      <StreamMarkdown content="Hello **world" parseIncompleteMarkdown />
    ));
    await flush();
    expect(container.querySelector("strong")).toBeTruthy();
    cleanup();
  });
});
