import { test, expect } from "@playwright/test";

// Both plugin providers must satisfy the same observable browser contract.
for (const provider of ["published", "native"]) {
  test(`${provider} public plugin subpaths render and update`, async ({
    page,
  }) => {
    await page.goto(`http://localhost:5198/test/browser/?plugins=${provider}`);
    await expect(page.locator("strong")).toHaveText("中文。");
    await expect(page.locator(".katex math")).toHaveCount(1);
    await expect(
      page.locator(".sd-code span[style*='--shiki-dark']").first(),
    ).toBeVisible();
    await expect(page.locator("[data-streamdown=mermaid] svg")).toBeVisible();
    await expect(page.locator("[data-streamdown=mermaid]")).toContainText(
      "Alpha",
    );
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.locator("[data-streamdown=mermaid]")).toContainText(
      "Updated",
    );
    await expect(page.locator("[data-streamdown=mermaid]")).not.toContainText(
      "Alpha",
    );
  });
}
