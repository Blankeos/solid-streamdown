import { test, expect } from "@playwright/test";

test("trusted SVG renders in native namespaces with browser presentation styles after updates", async ({
  page,
}) => {
  await page.goto("http://localhost:5198/test/browser/");
  await page.evaluate(async () => {
    const fixture = await import("/test/browser/svg-parity.tsx");
    fixture.mountSvgParity();
  });
  const path = page.locator("path");
  await expect(path).toHaveCSS("stroke-width", "2px");
  await expect(path).toHaveCSS("stroke-linecap", "round");
  await expect(path).toHaveCSS("fill-rule", "evenodd");
  expect(
    await page.evaluate(() => {
      const selectors = [
        "svg",
        "path",
        "a",
        "title",
        "foreignObject",
        "circle",
        "h1",
      ];
      return selectors.map(
        (selector) => document.querySelector(selector)?.namespaceURI,
      );
    }),
  ).toEqual([
    ...Array(6).fill("http://www.w3.org/2000/svg"),
    "http://www.w3.org/1999/xhtml",
  ]);
  await expect(page.locator("svg").first()).toHaveAttribute(
    "viewBox",
    "0 0 100 100",
  );
  await page.getByRole("button", { name: "revise" }).click();
  await expect(path).toHaveCSS("stroke-width", "7px");
});
