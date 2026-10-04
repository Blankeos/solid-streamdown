import { test, expect } from "@playwright/test";

test("long guide keeps aged characters visible during structural Markdown rewrites", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:5198/test/browser/?reveal&long");
  const result = await page.evaluate(async () => {
    const births = new Map<string, number>();
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
      for (const node of document.querySelectorAll(
        ".reveal span[data-sd-animate]",
      )) {
        const text = node.textContent!.trim();
        const count = counts.get(text) ?? 0;
        counts.set(text, count + 1);
        const key = `${node.getAttribute("data-sd-key") ?? `${text}:${count}`}:${text}`;
        if (!births.has(key)) births.set(key, now);
        const age = now - births.get(key)!;
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
    await new Promise((resolve) => setTimeout(resolve, 850));
    return {
      failures,
      aged,
      moving,
      count: births.size,
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
