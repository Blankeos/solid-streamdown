import { createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

/** Follow streaming output only while the reader remains near the bottom. */
export function pinnedScroll(active: () => boolean, enabled: () => boolean) {
  return (element: HTMLElement) => {
    if (isServer) return;
    let pinned = true;
    let previous = false;
    const scroll = () => {
      pinned =
        element.scrollHeight - element.scrollTop - element.clientHeight < 8;
    };
    const update = () => {
      if (active() && enabled() && pinned)
        element.scrollTop = element.scrollHeight;
    };
    element.addEventListener("scroll", scroll, { passive: true });
    const mutation = new MutationObserver(update);
    mutation.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    const resize =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    resize?.observe(element);
    createEffect(() => {
      const current = active();
      if (current && !previous) pinned = true;
      previous = current;
      enabled();
      update();
    });
    onCleanup(() => {
      mutation.disconnect();
      resize?.disconnect();
      element.removeEventListener("scroll", scroll);
    });
  };
}
