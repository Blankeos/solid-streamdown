/** CSS-driven reveals retain absolute start times across Markdown rewrites. */

import type { Element, Node, Root, Text } from "hast";

export interface AnimateOptions {
  /** Keyframes suffix after `sd-` (built-in: fadeIn, blurIn, slideUp; any custom string allowed). */
  animation?: string;
  /** Per-word animation duration in ms. @default 150 */
  duration?: number;
  /** CSS easing for the animation. @default "ease" */
  easing?: string;
  /** Split granularity. @default "word" */
  sep?: "word" | "char";
  /** Stagger delay between units in ms. @default 40 */
  stagger?: number;
  /**
   * Soft cap (ms) on how far ahead of wall-clock words may be scheduled.
   * Larger values favour longer cascades; smaller keeps fast streams caught up.
   * @default 320
   */
  maxBacklogMs?: number;
}

export interface AnimatePlugin {
  name: "animate";
  type: "animate";
  rehypePlugin: () => (tree: Root) => void;
  /** Mark the last rendered char count as settled (already visible). */
  commit: () => void;
  /** Char count written by the last rehype run (non-destructive). */
  getLastRenderCharCount: () => number;
  /** Manually set how many leading chars count as already-rendered. */
  setPrevContentLength: (length: number) => void;
}

/**
 * Hard budget for how long a cascade may run ahead of wall-clock.
 * Fast streams compress their stagger to fit instead of growing an
 * unbounded opacity:0 queue. The last delay never exceeds this budget —
 * large bursts drop below MIN_STAGGER_STEP_MS (even to 0) rather than
 * queueing seconds of invisible words.
 */
export const MAX_ANIMATION_BACKLOG_MS = 320;

/**
 * Legacy floor for per-word stagger under compression.
 * Kept for API compatibility; the timeline no longer enforces it as a hard
 * floor because 1000 chars at 4ms still queues ~3996ms despite the 320ms
 * budget. Compression now allows steps below this (even 0) so the hard cap
 * holds and no invisible seconds remain.
 */
export const MIN_STAGGER_STEP_MS = 4;

export interface ScheduleSlot {
  /** CSS delay (ms) for the first new word in this batch. */
  baseDelay: number;
  /** Effective stagger (ms) between words — may be < requested under load,
   * including below MIN_STAGGER_STEP_MS or 0 when the hard cap requires it. */
  step: number;
}

/**
 * Shared wall-clock timeline that serializes stagger delays across
 * streaming ticks. Render-pass protocol (driven by StreamMarkdown):
 * 1. `beginPass(now)` once before each rehype run
 * 2. plugin calls `take(wordCount, stagger, now)` once per pass
 * 3. `commitPass()` once after paint
 *
 * Re-entry safety is per-plugin via `mark`/`rewind`: the first rehype run
 * in a commit marks the cursor; a re-run rewinds before taking again so
 * delays stay identical.
 */
export interface AnimateTimeline {
  beginPass: (now: number) => void;
  commitPass: () => void;
  /** Snapshot of the working cursor. */
  mark: () => number;
  now: () => number;
  /** Restore the working cursor to a prior mark. */
  rewind: (mark: number) => void;
  take: (wordCount: number, stagger: number, now: number) => ScheduleSlot;
}

export interface CreateAnimateTimelineOptions {
  maxBacklogMs?: number;
  now?: () => number;
}

const defaultNow = (): number =>
  typeof performance === "undefined" ? Date.now() : performance.now();

export function createAnimateTimeline(
  options?: CreateAnimateTimelineOptions,
): AnimateTimeline {
  const nowFn = options?.now ?? defaultNow;
  const maxBacklog = options?.maxBacklogMs ?? MAX_ANIMATION_BACKLOG_MS;

  /** Committed absolute time when the next word may start. */
  let committedNextStartAt = 0;
  /** Working absolute time for the in-flight pass. */
  let passNextStartAt = 0;

  return {
    now: nowFn,
    beginPass(now: number) {
      // Resume from the last commit, but never more than maxBacklog ahead of
      // wall-clock so a fast stream stays caught up on the next tick.
      passNextStartAt = Math.min(
        Math.max(committedNextStartAt, now),
        now + maxBacklog,
      );
    },
    mark() {
      return passNextStartAt;
    },
    rewind(m: number) {
      passNextStartAt = m;
    },
    take(wordCount: number, stagger: number, now: number): ScheduleSlot {
      if (wordCount <= 0) {
        return { baseDelay: 0, step: Math.max(0, stagger) };
      }

      const idealStep = Math.max(0, stagger);
      const startAt = Math.max(passNextStartAt, now);
      const budgetEnd = now + maxBacklog;

      // Hard cap: no budget left means every word shares the max delay.
      if (startAt >= budgetEnd) {
        const baseDelay = Math.max(
          0,
          Math.round(Math.min(startAt, budgetEnd) - now),
        );
        // Stay at the cap; beginPass on the next tick keeps us caught up.
        passNextStartAt = startAt;
        return { baseDelay: Math.min(baseDelay, maxBacklog), step: 0 };
      }

      const idealLast = startAt + Math.max(0, wordCount - 1) * idealStep;
      let step = idealStep;
      if (idealLast > budgetEnd && wordCount > 1) {
        // Compress to fit the remaining span, allowing steps below
        // MIN_STAGGER_STEP_MS (even fractional/0) so 1000-char and 1200-word
        // bursts stay within budget instead of queueing invisible seconds.
        const span = budgetEnd - startAt;
        step = span / (wordCount - 1);
      }

      const baseDelay = Math.max(0, Math.round(startAt - now));
      passNextStartAt = startAt + wordCount * step;
      return { baseDelay, step };
    },
    commitPass() {
      committedNextStartAt = passNextStartAt;
    },
  };
}

interface ResolvedAnimateConfig {
  animation: string;
  duration: number;
  easing: string;
  sep: "word" | "char";
  stagger: number;
}

interface UnitTiming {
  bornAt: number;
  startAt: number;
  endAt: number;
}

interface AnimateRenderState {
  committedCharCount: number;
  lastRenderCharCount: number;
  timingByIdentity: Map<string, UnitTiming>;
}

const WHITESPACE_RE = /\s/;
const WHITESPACE_ONLY_RE = /^\s+$/;

/** Subtrees whose layout must not be disturbed by word spans. Inline `code` animates. */
const SKIP_TAGS = new Set(["pre", "svg", "math", "annotation"]);
/** Void elements with no text that still fade in. */
const VOID_ANIMATE_TAGS = new Set(["img", "hr"]);

const isElement = (node: unknown): node is Element =>
  typeof node === "object" &&
  node !== null &&
  "type" in node &&
  (node as Element).type === "element";

const hasSkipAncestor = (ancestors: Node[]): boolean =>
  ancestors.some(
    (ancestor) => isElement(ancestor) && SKIP_TAGS.has(ancestor.tagName),
  );

const findLiAncestor = (ancestors: Node[]): Element | undefined => {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (isElement(ancestor) && ancestor.tagName === "li") {
      return ancestor;
    }
  }
  return undefined;
};

const LIST_CONTAINER_TAGS = new Set(["ul", "ol", "li"]);

const findCheckbox = (element: Element): Element | undefined => {
  for (const child of element.children) {
    if (!isElement(child)) {
      continue;
    }
    if (child.tagName === "input") {
      return child;
    }
    if (LIST_CONTAINER_TAGS.has(child.tagName)) {
      continue;
    }
    const nested = findCheckbox(child);
    if (nested) {
      return nested;
    }
  }
  return undefined;
};

const appendStyle = (element: Element, declaration: string): void => {
  element.properties ??= {};
  const existing =
    typeof element.properties.style === "string" &&
    element.properties.style.length > 0
      ? `${element.properties.style};`
      : "";
  element.properties.style = `${existing}${declaration}`;
};

const stampAnimation = (
  element: Element,
  config: ResolvedAnimateConfig,
  duration: number,
  delay: number,
  offset?: number,
): void => {
  element.properties ??= {};
  element.properties["data-sd-animate"] = true;
  if (offset !== undefined) {
    element.properties["data-sd-offset"] = offset;
  }
  appendStyle(
    element,
    `--sd-animation:sd-${config.animation};--sd-duration:${duration}ms;--sd-easing:${config.easing}` +
      (delay !== 0 ? `;--sd-delay:${Math.round(delay)}ms` : ""),
  );
};

const stampMarker = (
  li: Element,
  duration: number,
  delay: number,
  easing: string,
  offset?: number,
): void => {
  li.properties ??= {};
  li.properties["data-sd-animate-marker"] = true;
  if (offset !== undefined) {
    // Same stable key the renderer freezes on (`data-sd-offset`).
    // The marker lives on the <li> host; its timing follows the item's
    // first word so ::marker fades together with the reveal.
    li.properties["data-sd-offset"] = offset;
  }
  appendStyle(
    li,
    `--sd-marker-duration:${duration}ms;--sd-marker-delay:${Math.round(delay)}ms;--sd-marker-easing:${easing}`,
  );
};

const stampCheckbox = (
  li: Element,
  config: ResolvedAnimateConfig,
  duration: number,
  delay: number,
  offset?: number,
): void => {
  const input = findCheckbox(li);
  if (input) {
    stampAnimation(input, config, duration, delay, offset);
  }
};

/**
 * Split text into animateable units. Trailing whitespace is glued onto the
 * preceding visible token so it lives inside the same `<span>` — otherwise a
 * bare space under an underlined `<a>` paints the underline before the word
 * fades in.
 */
const splitByWord = (text: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let inWhitespace = false;

  for (const char of text) {
    const isWhitespace = WHITESPACE_RE.test(char);
    if (isWhitespace !== inWhitespace && current) {
      if (isWhitespace) {
        current += char;
        inWhitespace = true;
        continue;
      }
      parts.push(current);
      current = "";
    }
    current += char;
    inWhitespace = isWhitespace;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
};

const splitGraphemes = (text: string): string[] => {
  const Segmenter =
    (globalThis as unknown as Record<string, unknown>).Intl &&
    (Intl as unknown as Record<string, unknown>).Segmenter
      ? (
          Intl as unknown as {
            Segmenter: new (...args: never[]) => {
              segment: (s: string) => Iterable<{ segment: string }>;
            };
          }
        ).Segmenter
      : undefined;
  if (Segmenter) {
    try {
      const segmenter = new (
        Segmenter as new (
          locale?: string,
          opts?: object,
        ) => { segment: (s: string) => Iterable<{ segment: string }> }
      )(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(text), (part) => part.segment);
    } catch {
      // Fall through to code-point splitting.
    }
  }
  return Array.from(text);
};

const splitByChar = (text: string): string[] => {
  const parts: string[] = [];
  let whitespaceBuffer = "";

  for (const char of splitGraphemes(text)) {
    if (WHITESPACE_RE.test(char)) {
      if (
        parts.length > 0 &&
        !WHITESPACE_ONLY_RE.test(parts[parts.length - 1])
      ) {
        parts[parts.length - 1] += char;
      } else {
        whitespaceBuffer += char;
      }
    } else {
      if (whitespaceBuffer) {
        parts.push(whitespaceBuffer);
        whitespaceBuffer = "";
      }
      parts.push(char);
    }
  }

  if (whitespaceBuffer) {
    if (parts.length > 0) {
      parts[parts.length - 1] += whitespaceBuffer;
    } else {
      parts.push(whitespaceBuffer);
    }
  }

  return parts;
};

const makeSpan = (
  word: string,
  config: ResolvedAnimateConfig,
  delay: number,
  offset: number,
  duration: number,
  identity: string,
): Element => {
  const element: Element = {
    type: "element",
    tagName: "span",
    properties: {},
    children: [{ type: "text", value: word }],
  };
  stampAnimation(element, config, duration, delay, offset);
  element.properties["data-sd-key"] = identity;
  return element;
};

const isVoidAnimateElement = (node: Node): node is Element =>
  isElement(node) && VOID_ANIMATE_TAGS.has(node.tagName);

type ParentWithChildren = Node & { children: Array<Node> };

const collectTextAndVoid = (
  tree: Root,
): Array<{ node: Text | Element; ancestors: Node[] }> => {
  const found: Array<{ node: Text | Element; ancestors: Node[] }> = [];
  const walk = (nodes: Node[], ancestors: Node[]): void => {
    for (const node of nodes) {
      if (node.type === "text" || isVoidAnimateElement(node)) {
        found.push({ node: node as Text | Element, ancestors: [...ancestors] });
      }
      if (isElement(node)) {
        walk(node.children as Node[], [...ancestors, node]);
      }
    }
  };
  walk(tree.children as Node[], []);
  return found;
};

/** Preserve animation history by source origin, not flattened rendered order. */
export function createAnimatePlugin(
  options?: AnimateOptions & { timeline?: AnimateTimeline },
): AnimatePlugin {
  const config: ResolvedAnimateConfig = {
    animation: options?.animation ?? "fadeIn",
    duration: options?.duration ?? 150,
    easing: options?.easing ?? "ease",
    sep: options?.sep ?? "word",
    stagger: options?.stagger ?? 40,
  };
  const timeline = options?.timeline;
  const state: AnimateRenderState = {
    committedCharCount: 0,
    lastRenderCharCount: 0,
    timingByIdentity: new Map(),
  };

  const rehypePlugin = () => (tree: Root) => {
    const now = timeline?.now() ?? defaultNow();
    const entries = collectTextAndVoid(tree);
    // Source positions survive loose-list, table, and reference rewrites.
    // Positionless custom HAST uses rendered offsets as a fallback.
    const identityFor = (
      node: Text | Element,
      local: number,
      offset: number,
    ) =>
      node.position
        ? `source:${node.position.start.offset ?? 0}:${local}`
        : `rendered:${offset}`;
    let renderedOffset = 0;
    let newCount = 0;
    for (const { node, ancestors } of entries) {
      if (hasSkipAncestor(ancestors)) continue;
      if (node.type !== "text") {
        if (!state.timingByIdentity.has(identityFor(node, 0, renderedOffset)))
          newCount++;
        renderedOffset++;
        continue;
      }
      const parts =
        config.sep === "char"
          ? splitByChar(node.value)
          : splitByWord(node.value);
      let local = 0;
      for (const part of parts) {
        if (
          ancestors.length &&
          part.trim() &&
          !state.timingByIdentity.has(identityFor(node, local, renderedOffset))
        )
          newCount++;
        local += part.length;
        renderedOffset += part.length;
      }
    }
    const schedule = timeline
      ? timeline.take(newCount, config.stagger, now)
      : { baseDelay: 0, step: config.stagger };
    let newIndex = 0;
    const seedSettledPrefix = state.timingByIdentity.size === 0;
    const timingFor = (identity: string, offset: number) => {
      let timing = state.timingByIdentity.get(identity);
      if (!timing) {
        const settled = seedSettledPrefix && offset < state.committedCharCount;
        const startAt = settled
          ? now - config.duration
          : now + schedule.baseDelay + newIndex++ * schedule.step;
        timing = { bornAt: now, startAt, endAt: startAt + config.duration };
        state.timingByIdentity.set(identity, timing);
      }
      return {
        duration: now >= timing.endAt ? 0 : config.duration,
        delay: now >= timing.endAt ? 0 : timing.startAt - now,
      };
    };

    const counter = { count: 0 };

    for (const { node, ancestors } of entries) {
      if (node.type !== "text") {
        if (hasSkipAncestor(ancestors)) continue;
        const offset = counter.count++;
        const identity = identityFor(node, 0, offset);
        const timing = timingFor(identity, offset);
        stampAnimation(
          node as Element,
          config,
          timing.duration,
          timing.delay,
          offset,
        );
        (node as Element).properties["data-sd-key"] = identity;
        continue;
      }
      const textNode = node as Text;
      const parent = ancestors[ancestors.length - 1] as
        ParentWithChildren | undefined;
      if (!parent || !("children" in parent)) {
        counter.count += textNode.value.length;
        continue;
      }
      if (hasSkipAncestor(ancestors)) {
        continue;
      }
      const text = textNode.value;
      if (!text.trim()) {
        counter.count += text.length;
        continue;
      }
      const parts =
        config.sep === "char" ? splitByChar(text) : splitByWord(text);
      const siblings = parent.children as Array<Element | Text | Node>;
      const index = siblings.indexOf(textNode as unknown as Element & Text);
      if (index === -1) {
        counter.count += text.length;
        continue;
      }
      const liAncestor = findLiAncestor(ancestors);
      const needsMarker = Boolean(
        liAncestor && !liAncestor.properties?.["data-sd-animate-marker"],
      );
      let markerStamped = false;
      let local = 0;
      const replacement: Array<Element | Text> = parts.map((part) => {
        const identity = identityFor(textNode, local, counter.count);
        local += part.length;
        const partStart = counter.count;
        counter.count += part.length;
        if (WHITESPACE_ONLY_RE.test(part)) {
          return { type: "text", value: part } as Text;
        }
        const { duration, delay } = timingFor(identity, partStart);
        if (liAncestor && needsMarker && !markerStamped) {
          stampMarker(liAncestor, duration, delay, config.easing, partStart);
          stampCheckbox(liAncestor, config, duration, delay, partStart);
          liAncestor.properties["data-sd-key"] = identity;
          const checkbox = findCheckbox(liAncestor);
          if (checkbox) checkbox.properties["data-sd-key"] = identity;
          markerStamped = true;
        }
        return makeSpan(part, config, delay, partStart, duration, identity);
      });
      siblings.splice(index, 1, ...(replacement as unknown as Array<Node>));
    }

    state.lastRenderCharCount = counter.count;
  };

  Object.defineProperty(rehypePlugin, "name", { value: "rehypeAnimate" });

  return {
    name: "animate",
    type: "animate",
    rehypePlugin,
    setPrevContentLength(length: number) {
      state.committedCharCount = length;
    },
    getLastRenderCharCount() {
      return state.lastRenderCharCount;
    },
    commit() {
      state.committedCharCount = state.lastRenderCharCount;
    },
  };
}

export const animate = createAnimatePlugin();
