import { test, expect, type Page } from "@playwright/test";

async function expectReport(page: Page) {
  const reveal = page.locator(".reveal");
  await expect(reveal.locator("p")).toHaveText([
    "Report paid on 2026-10-04: $1,234.56.",
    "Final total: $1,313.46.",
  ]);
  await expect(reveal.locator("th")).toHaveText(["Date", "Amount", "Status"]);
  await expect(reveal.locator("td")).toHaveText([
    "2026-10-04",
    "$1,234.56",
    "paid in USD",
    "2026-10-05",
    "$78.90",
    "pending",
  ]);
  await expect(reveal.locator('[data-streamdown="strong"] em code')).toHaveText(
    ["2026-10-04", "USD"],
  );
  await expect(reveal.locator("pre code")).toHaveText("2026-10-04 $1,234.56\n");
}

test("Custom char reveal progresses through rapid appends, drains backlog, and cleans up", async ({
  page,
}) => {
  await page.goto("http://localhost:5198/test/browser/?reveal");
  // Keep the actual browser Animation reference local, not a test-only renderer hook.
  const samples = await page.evaluate(async () => {
    (document.querySelector("button") as HTMLButtonElement).click();
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    const prefix = document.querySelector(".reveal [data-sd-animate]")!;
    const animation = prefix.getAnimations()[0];
    const started = performance.now();
    const firstTime = Number(animation.currentTime);
    const firstText = document.querySelector(".reveal")!.textContent;
    while (performance.now() - started < 100) await frame();
    const mid = {
      retained: prefix.getAnimations()[0] === animation,
      time: Number(animation.currentTime),
      opacity: Number(getComputedStyle(prefix).opacity),
      appended: document.querySelector(".reveal")!.textContent !== firstText,
      appending: document
        .querySelector("[data-appending]")!
        .getAttribute("data-appending"),
    };
    while (performance.now() - started < 200) await frame();
    return {
      firstTime,
      mid,
      later: {
        retained: prefix.getAnimations()[0] === animation,
        time: Number(animation.currentTime),
        opacity: Number(getComputedStyle(prefix).opacity),
      },
    };
  });
  expect(samples.mid.appending).toBe("true");
  expect(samples.mid.appended).toBe(true);
  expect(samples.mid.retained).toBe(true);
  expect(samples.mid.time).toBeGreaterThan(samples.firstTime + 60);
  expect(samples.mid.opacity).toBeGreaterThan(0);
  expect(samples.mid.opacity).toBeLessThan(1);
  expect(samples.later.retained).toBe(true);
  expect(samples.later.time).toBeGreaterThan(samples.mid.time + 60);
  expect(samples.later.opacity).toBeGreaterThan(samples.mid.opacity);
  const drained = await page.evaluate(async () => {
    const root = document.querySelector(".reveal")!;
    const status = document.querySelector("[data-appending]")!;
    await new Promise<void>((resolve) => {
      if (status.getAttribute("data-appending") === "false") return resolve();
      const observer = new MutationObserver(() => {
        if (status.getAttribute("data-appending") === "false") {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(status, {
        attributes: true,
        attributeFilter: ["data-appending"],
      });
    });
    const started = performance.now();
    // 320ms max delay + 450ms reveal, with less than 80ms paint slack.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const spans = Array.from(root.querySelectorAll("[data-sd-animate]"));
    return {
      elapsed: performance.now() - started,
      count: spans.length,
      invisible: spans
        .filter((node) => Number(getComputedStyle(node).opacity) !== 1)
        .map((node) => node.textContent),
      text: root.textContent,
    };
  });
  expect(drained.elapsed).toBeLessThanOrEqual(850);
  expect(drained.count).toBeGreaterThan(100);
  expect(drained.invisible).toEqual([]);
  await expectReport(page);
  await expect(page.locator("[data-animating]")).toHaveAttribute(
    "data-animating",
    "true",
  );
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.locator(".reveal [data-sd-animate]")).toHaveCount(0);
  await expectReport(page);
  expect(await page.locator(".reveal").textContent()).toBe(drained.text);
});

test("Custom reveal honors reduced motion during streaming", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://localhost:5198/test/browser/?reveal");
  await page.getByRole("button", { name: "Start stream" }).click();
  await expect(page.locator(".reveal [data-sd-animate]").first()).toBeVisible();
  const check = () =>
    page.locator(".reveal [data-sd-animate]").evaluateAll((nodes) => ({
      count: nodes.length,
      animated: nodes.filter(
        (node) =>
          node.getAnimations().length > 0 ||
          getComputedStyle(node).animationName !== "none",
      ).length,
      invisible: nodes.filter((node) => getComputedStyle(node).opacity !== "1")
        .length,
    }));
  expect(await check()).toMatchObject({ animated: 0, invisible: 0 });
  await expect(page.locator("[data-appending]")).toHaveAttribute(
    "data-appending",
    "false",
  );
  expect(await check()).toMatchObject({ animated: 0, invisible: 0 });
  await expectReport(page);
});
