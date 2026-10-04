import { test, expect } from "@playwright/test";

test("useChat streams text parts without replacing native hosts or prefix animations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5198/test/browser/");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      const fixture = await import("/test/browser/chat-example.tsx");
      fixture.mountChatExample();
    });
  }).toPass();
  await expect(page.locator("output")).toHaveText("ready");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("output")).toHaveText("streaming");
  await expect(page.locator("p")).toHaveText(["Hi", "Hello"]);
  const retained = await page.evaluate(async () => {
    const host = document.querySelectorAll("p")[1];
    const prefix = host.querySelector("[data-sd-animate]")!;
    const animation = prefix.getAnimations()[0];
    (
      Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Append",
      ) as HTMLButtonElement
    ).click();
    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.querySelectorAll("p")[1]?.textContent === "Hello world") {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    return {
      host: document.querySelectorAll("p")[1] === host,
      prefix: host.querySelector("[data-sd-animate]") === prefix,
      animation: !!animation && prefix.getAnimations()[0] === animation,
    };
  });
  expect(retained).toEqual({ host: true, prefix: true, animation: true });
  await expect(page.locator("p")).toHaveText(["Hi", "Hello world"]);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.locator("output")).toHaveText("ready");
  await expect(page.locator("p")).toHaveText(["Hi", "Hello world"]);
  await expect
    .poll(() =>
      page
        .locator("p [data-sd-animate]")
        .evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node).opacity === "1"),
        ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
