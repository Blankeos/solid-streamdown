import { test, expect } from "@playwright/test";

test("long guide keeps aged characters visible during structural Markdown rewrites", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:5198/test/browser/?reveal&long");
  const result = await page.evaluate(async () => {
    // Age is accumulated per rendered frame, with each frame's contribution
    // capped. Wall-clock age is not a valid bound for a CSS animation: when
    // the main thread stalls (loaded machines, CI runners) no frames render,
    // an element created before the stall only starts its animation after it,
    // and a fully elapsed 850ms can correspond to ~0ms of animation progress.
    const ages = new Map<string, number>();
    let previousFrame = performance.now();
    const failures: unknown[] = [];
    let aged = 0,
      moving = 0;
    (document.querySelector("button") as HTMLButtonElement).click();
    const status = document.querySelector("[data-appending]")!;
    while (status.getAttribute("data-appending") === "true") {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const counts = new Map<string, number>();
      const now = performance.now();
      const frameDelta = Math.min(now - previousFrame, 50);
      previousFrame = now;
      for (const node of document.querySelectorAll(
        ".reveal span[data-sd-animate]",
      )) {
        const text = node.textContent!.trim();
        const count = counts.get(text) ?? 0;
        counts.set(text, count + 1);
        const identity = node.getAttribute("data-sd-key");
        const source = identity?.match(/^source:(\d+)(?::(\d+))?$/);
        // Observe the absolute source character, independently of how the
        // current parser partitions it into text nodes after a rewrite.
        const origin = source
          ? `source:${Number(source[1]) + Number(source[2] ?? 0)}`
          : (identity ?? `${text}:${count}`);
        const key = `${origin}:${text}`;
        const age = (ages.get(key) ?? -frameDelta) + frameDelta;
        ages.set(key, age);
        const opacity = Number(getComputedStyle(node).opacity);
        if (opacity > 0 && opacity < 1) moving++;
        if (age >= 850) {
          aged++;
          if (opacity !== 1 && failures.length < 20)
            failures.push({
              text,
              key,
              age,
              opacity,
              parent: node.parentElement!.tagName,
              identity: node.getAttribute("data-sd-key"),
              offset: node.getAttribute("data-sd-offset"),
              style: node.getAttribute("style"),
              time: node.getAnimations()[0]?.currentTime,
              playState: node.getAnimations()[0]?.playState,
              connected: node.isConnected,
              rect: node.getBoundingClientRect().y,
            });
        }
      }
    }
    // Let in-flight reveals run to completion (bounded) instead of sleeping a
    // fixed time: animations only advance on rendered frames.
    await Promise.race([
      Promise.all(
        document
          .querySelector(".reveal")!
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      ),
      new Promise((resolve) => setTimeout(resolve, 30000)),
    ]);
    return {
      failures,
      aged,
      moving,
      count: ages.size,
      invisible: [
        ...document.querySelectorAll(".reveal [data-sd-animate]"),
      ].filter((n) => getComputedStyle(n).opacity !== "1").length,
    };
  });
  expect(result.moving).toBeGreaterThan(100);
  expect(result.aged).toBeGreaterThan(1000);
  expect(result.count).toBeGreaterThan(1000);
  expect(result.failures).toEqual([]);
  expect(result.invisible).toBe(0);
  await expect(page.locator(".reveal table")).toHaveCount(1);
  await expect(page.locator(".reveal pre")).toHaveCount(2);
});
