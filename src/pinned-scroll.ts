import { createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

/** Follow streaming output only while the reader remains near the bottom. */
export function pinnedScroll(active: () => boolean, enabled: () => boolean) {
  return (element: HTMLElement) => {
    if (isServer) return;
    let pinned = true;
    let frame: number | undefined;
    const scroll = () => {
      pinned =
        element.scrollHeight - element.scrollTop - element.clientHeight < 8;
    };
    const update = () => {
      if (frame !== undefined || !active() || !enabled() || !pinned) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (active() && enabled() && pinned) {
          const bottom = Math.max(
            0,
            element.scrollHeight - element.clientHeight,
          );
          if (element.scrollTop !== bottom) element.scrollTop = bottom;
        }
      });
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
      active();
      enabled();
      update();
    });
    onCleanup(() => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      mutation.disconnect();
      resize?.disconnect();
      element.removeEventListener("scroll", scroll);
    });
  };
}
