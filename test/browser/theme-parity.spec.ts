import { test, expect } from "@playwright/test";
test("provider roots and token theme fallbacks preserve colors and typography without Tailwind", async ({
  page,
}) => {
  await page.goto("http://localhost:5198/test/browser/");
  await page.evaluate(async () => {
    const fixture = await import("/test/browser/theme-parity.tsx");
    fixture.mountThemeParity();
  });
  const plain = page.locator('[data-dual="false"]'),
    dual = page.locator('[data-dual="true"][data-root-style="true"]'),
    dualWithoutRoot = page.locator(
      '[data-dual="true"][data-root-style="false"]',
    );
  for (const scope of [plain, dual, dualWithoutRoot]) {
    await expect(scope.locator("pre")).toHaveCSS(
      "background-color",
      "rgb(241, 242, 243)",
    );
    await expect(scope.locator(".sd-code-token").first()).toHaveCSS(
      "color",
      "rgb(18, 52, 86)",
    );
    await expect(scope.locator(".sd-code")).toHaveCSS("padding", "16px");
    await expect(scope.locator(".sd-code-actions")).toHaveCSS(
      "position",
      "absolute",
    );
    await expect(scope.locator('[data-streamdown="code-block"]')).toHaveCSS(
      "content-visibility",
      "auto",
    );
  }
  await expect(plain.locator("pre")).toHaveCSS("color", "rgb(17, 34, 51)");
  await page.getByRole("button", { name: "theme", exact: true }).click();
  await expect(dualWithoutRoot.locator("pre")).toHaveCSS(
    "background-color",
    "rgb(241, 242, 243)",
  );
  await expect(dualWithoutRoot.locator(".sd-code-token").first()).toHaveCSS(
    "color",
    "rgb(170, 187, 204)",
  );
  await expect(plain.locator(".sd-code-token").last()).toHaveCSS(
    "color",
    "rgb(17, 34, 51)",
  );
  await expect(dual.locator(".sd-code-token").last()).toHaveCSS(
    "color",
    "rgb(171, 205, 239)",
  );
  await expect(plain.locator("pre")).toHaveCSS(
    "background-color",
    "rgb(241, 242, 243)",
  );
  await expect(plain.locator(".sd-code-token").first()).toHaveCSS(
    "color",
    "rgb(18, 52, 86)",
  );
  await expect(plain.locator(".sd-code-token").first()).toHaveCSS(
    "background-color",
    "rgb(221, 238, 255)",
  );
  await expect(dual.locator("pre")).toHaveCSS(
    "background-color",
    "rgb(32, 33, 34)",
  );
  await expect(dual.locator(".sd-code-token").first()).toHaveCSS(
    "color",
    "rgb(170, 187, 204)",
  );
  await expect(dual.locator(".sd-code-token").first()).toHaveCSS(
    "background-color",
    "rgb(51, 68, 85)",
  );
  for (const scope of [plain, dual, dualWithoutRoot]) {
    await expect(scope.locator(".sd-code-token").first()).toHaveCSS(
      "font-style",
      "italic",
    );
    await expect(scope.locator(".sd-code-token").first()).toHaveCSS(
      "font-weight",
      "700",
    );
    await expect(scope.locator(".sd-code-token").first()).toHaveCSS(
      "text-decoration-line",
      "underline",
    );
  }
  await plain.getByRole("button", { name: "external" }).click();
  await expect(page.locator('[data-streamdown="link-safety-modal"]')).toHaveCSS(
    "backdrop-filter",
    "blur(4px)",
  );
  await expect(page.locator(".sd-link-modal")).toHaveCSS("max-width", "448px");
});
