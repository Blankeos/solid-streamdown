import { test, expect } from "@playwright/test";

for (const renderer of ["native", "legacy"]) {
  test(`${renderer} replays repeated prefixes without replacing paragraph hosts`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:5198/test/browser/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      const fixture = await import("/test/browser/session-reveal.tsx");
      fixture.mountSessionReveal();
    });
    const result = await page.evaluate(async (renderer) => {
      const root = document.querySelector(`.${renderer}-session`)!;
      const frame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const wait = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      const click = (text: string) =>
        (
          Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent === text,
          ) as HTMLButtonElement
        ).click();
      await wait(850);
      const host = root.querySelector("p");
      const old = root.querySelector("[data-sd-animate]")!;
      const settled = Number(getComputedStyle(old).opacity);
      click("Backtrack");
      const fresh = root.querySelector("[data-sd-animate]")!;
      // Sample well inside the first unit's duration, not at opacity zero on
      // its first paint, and before a full animation could have drained.
      await frame();
      await frame();
      await wait(65);
      const replay = {
        opacity: Number(getComputedStyle(fresh).opacity),
        animation: getComputedStyle(fresh).animationName,
        sameHost: root.querySelector("p") === host,
      };
      const animation = fresh.getAnimations()[0];
      const before = Number(animation?.currentTime);
      click("Append");
      await frame();
      await wait(65);
      const append = {
        sameHost: root.querySelector("p") === host,
        sameUnit: root.querySelector("[data-sd-animate]") === fresh,
        retained: fresh.getAnimations()[0] === animation,
        time: Number(animation?.currentTime),
        before,
      };
      await wait(850);
      const drained = Array.from(
        root.querySelectorAll("[data-sd-animate]"),
      ).every((n) => getComputedStyle(n).opacity === "1");
      click("Stop");
      click("Restart");
      await frame();
      await frame();
      await wait(65);
      const restarted = Number(
        getComputedStyle(root.querySelector("[data-sd-animate]")!).opacity,
      );
      const restartHost = root.querySelector("p") === host;
      // Clear/rewrite in rapid successive updates must retire old history.
      for (let i = 0; i < 3; i++) {
        click("Clear");
        click("Rewrite");
      }
      await frame();
      await frame();
      await wait(65);
      const rewritten = Number(
        getComputedStyle(root.querySelector("[data-sd-animate]")!).opacity,
      );
      await wait(850);
      const finalVisible = Array.from(
        root.querySelectorAll("[data-sd-animate]"),
      ).every((n) => getComputedStyle(n).opacity === "1");
      click("Static");
      await frame();
      return {
        settled,
        replay,
        append,
        drained,
        restarted,
        restartHost,
        rewritten,
        finalVisible,
        staticUnits: root.querySelectorAll("[data-sd-animate]").length,
        staticAnimations: root.getAnimations({ subtree: true }).length,
        text: root.textContent,
      };
    }, renderer);
    expect(result.settled).toBe(1);
    expect(result.replay.animation).toBe("sd-customReveal");
    expect(result.replay.sameHost).toBe(true);
    expect(result.replay.opacity).toBeGreaterThan(0);
    expect(result.replay.opacity).toBeLessThan(1);
    expect(result.append.sameHost).toBe(true);
    expect(result.append.sameUnit).toBe(true);
    expect(result.append.retained).toBe(true);
    expect(result.append.time).toBeGreaterThan(result.append.before + 30);
    expect(result.drained).toBe(true);
    expect(result.restartHost).toBe(true);
    expect(result.restarted).toBeGreaterThan(0);
    expect(result.restarted).toBeLessThan(1);
    expect(result.rewritten).toBeGreaterThan(0);
    expect(result.rewritten).toBeLessThan(1);
    expect(result.finalVisible).toBe(true);
    expect(result.staticUnits).toBe(0);
    expect(result.staticAnimations).toBe(0);
    expect(result.text).toBe("Repeat prefix");
    expect(errors).toEqual([]);
  });
}
