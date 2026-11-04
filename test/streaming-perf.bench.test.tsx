import { describe, expect, it } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Streamdown } from "../src/index";

// Opt-in: SD_BENCH=1 bunx vitest run test/streaming-perf.bench.test.tsx
const run = process.env.SD_BENCH ? it : it.skip;

const sentence =
  "The model considers the **constraints** carefully, weighing each option against the `budget` and the timeline before it commits. ";

describe("streaming perf", () => {
  run(
    "streams a long single paragraph",
    async () => {
      let full = "";
      const target = Number(process.env.SD_BENCH_LEN ?? 6000);
      while (full.length < target) full += sentence;
      // Manual frame queue so coalesced updates can be flushed synchronously.
      const queue: FrameRequestCallback[] = [];
      const originalRaf = globalThis.requestAnimationFrame;
      const originalCancel = globalThis.cancelAnimationFrame;
      globalThis.requestAnimationFrame = (cb) => queue.push(cb);
      globalThis.cancelAnimationFrame = (id) => {
        queue[id - 1] = () => {};
      };
      const flushFrames = () => {
        while (queue.length) queue.splice(0).forEach((cb) => cb(0));
      };
      const [text, setText] = createSignal("");
      const [animating, setAnimating] = createSignal(true);
      const container = document.createElement("div");
      document.body.appendChild(container);
      const dispose = render(
        () => (
          <Streamdown
            isAnimating={animating()}
            animated={{
              animation: "quartaReveal",
              duration: 450,
              easing: "ease-in-out",
              sep: "char",
              stagger: 8,
              maxBacklogMs: 320,
            }}
          >
            {text()}
          </Streamdown>
        ),
        container,
      );
      const start = performance.now();
      let slowest = 0;
      for (let i = 20; i <= full.length + 19; i += 20) {
        const t = performance.now();
        setText(full.slice(0, i));
        flushFrames();
        slowest = Math.max(slowest, performance.now() - t);
      }
      const total = performance.now() - start;
      setAnimating(false);
      flushFrames();
      console.log(
        `streamed ${full.length} chars in ${Math.ceil(full.length / 20)} updates: total ${total.toFixed(0)}ms, slowest update ${slowest.toFixed(1)}ms`,
      );
      expect(container.textContent).toBe(full.replace(/\*\*|`/g, "").trimEnd());
      if (process.env.SD_BENCH_OUT)
        (await import("node:fs")).writeFileSync(
          process.env.SD_BENCH_OUT,
          container.innerHTML.replace(/ style="[^"]*"/g, ""),
        );
      dispose();
      container.remove();
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    },
    600_000,
  );
});
