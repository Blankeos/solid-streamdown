import { test, expect } from "@playwright/test";
test("built node SSR markup is hydrated in Chromium without replacing nodes or leaking portals", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (["warning", "error"].includes(e.type())) errors.push(e.text());
  });
  const html = await (await request.get("http://localhost:5199")).text();
  expect(html).toContain("data-hk=");
  expect(html).toContain("const hydrated = true;");
  expect(html).not.toContain('role="dialog"');
  await page.goto("http://localhost:5199");
  await expect
    .poll(() => page.evaluate(() => (window as any).hydrationProof?.reused))
    .toBe(true);
  await expect(page.locator("#standalone")).toHaveAttribute(
    "aria-label",
    "Source",
  );
  await expect(
    page.locator("#standalone .sd-code-line").first(),
  ).toHaveAttribute("data-line", "7");
  await expect(
    page.locator('[data-streamdown="image-placeholder"]'),
  ).toHaveCount(1);
  await expect(page.locator('[aria-label="Download image"]')).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator('[data-streamdown="code-block-body"] span[style*="shiki"]')
        .count(),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "external", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "external", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.evaluate(() => (window as any).hydrationProof.dispose());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  expect(errors).toEqual([]);
});
