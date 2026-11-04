import type { Root, RootContent, ElementContent, Element, Text } from "hast";
import type { Position } from "unist";

type HastNode = Root | RootContent | ElementContent;

/**
 * In-flight reveal delays are stamped relative to the render that produced
 * them, so they shrink on every pass. A rendered host's CSS animation started
 * when it was inserted, so the delay it was created with stays correct; only a
 * freshly created host needs the current value. Hosts persist per child index
 * (renderers use `<Index>`), which is exactly how this reconciler pairs nodes.
 */
const DELAY_DECLARATION_RE = /;?--sd-(?:marker-)?delay:-?[\d.]+ms/g;

const isAnimatedHost = (properties: Element["properties"]): boolean =>
  properties["data-sd-key"] != null &&
  (properties["data-sd-animate"] != null ||
    properties["data-sd-animate-space"] != null ||
    properties["data-sd-animate-marker"] != null);

const samePosition = (a?: Position, b?: Position): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.start.offset === b.start.offset &&
    a.end.offset === b.end.offset &&
    a.start.line === b.start.line &&
    a.start.column === b.start.column &&
    a.end.line === b.end.line &&
    a.end.column === b.end.column);

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1)
      if (a[index] !== b[index]) return false;
    return true;
  }
  return false;
};

const stripDelays = (style: unknown): unknown =>
  typeof style === "string" ? style.replace(DELAY_DECLARATION_RE, "") : style;

const sameProperties = (
  previous: Element["properties"],
  next: Element["properties"],
): boolean => {
  if (previous === next) return true;
  if (!previous || !next) return false;
  const keys = Object.keys(next);
  if (keys.length !== Object.keys(previous).length) return false;
  const animated =
    isAnimatedHost(next) && previous["data-sd-key"] === next["data-sd-key"];
  for (const key of keys) {
    if (!Object.hasOwn(previous, key)) return false;
    const a = previous[key];
    const b = next[key];
    if (key === "style" && animated) {
      if (a !== b && stripDelays(a) !== stripDelays(b)) return false;
    } else if (!sameValue(a, b)) return false;
  }
  return true;
};

/**
 * Structural sharing between consecutive HAST renders: every subtree equal to
 * the previous render (modulo in-flight reveal delays, see above) keeps its
 * previous object identity, so reference-keyed renderers skip it entirely.
 * Neither tree is mutated; changed nodes are shallow copies of `next`.
 */
/**
 * `next` nodes that come back unchanged on a later pass (the animate plugin
 * reuses fully revealed spans) map to the node shared for them last time, so
 * the comparison is skipped while that node still occupies the slot.
 */
const copies = new WeakMap<object, HastNode>();

export function shareHast<T extends HastNode>(
  previous: HastNode | undefined,
  next: T,
): T {
  if (!previous || previous === next) return next;
  if (copies.get(next) === previous) return previous as T;
  if (previous.type !== next.type) return next;
  const positionShared = samePosition(previous.position, next.position);
  if (next.type === "text" || next.type === "comment" || next.type === "raw")
    return positionShared && (previous as Text).value === (next as Text).value
      ? (previous as T)
      : next;
  if (next.type !== "element" && next.type !== "root") return next;
  const prevParent = previous as Element | Root;
  const nextParent = next as Element | Root;
  let propertiesShared = true;
  if (next.type === "element") {
    const prevElement = previous as Element;
    if (prevElement.tagName !== next.tagName) return next;
    propertiesShared = sameProperties(prevElement.properties, next.properties);
  }
  // Position/data/content differences still allow sharing descendants.
  const selfShared =
    propertiesShared &&
    positionShared &&
    prevParent.data === nextParent.data &&
    (next.type !== "element" || (previous as Element).content === next.content);
  const prevChildren = prevParent.children as HastNode[];
  const nextChildren = nextParent.children as HastNode[];
  let childrenShared = prevChildren.length === nextChildren.length;
  const children = nextChildren.map((child, index) => {
    const shared = shareHast(prevChildren[index], child);
    if (shared !== prevChildren[index]) childrenShared = false;
    return shared;
  });
  if (selfShared && childrenShared) {
    copies.set(next, previous);
    return previous as T;
  }
  const copy = { ...nextParent } as Element | Root;
  copy.children = (childrenShared ? prevChildren : children) as never;
  if (propertiesShared && copy.type === "element")
    copy.properties = (previous as Element).properties;
  copies.set(next, copy);
  return copy as T;
}
