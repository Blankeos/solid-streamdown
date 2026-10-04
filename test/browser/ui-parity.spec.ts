import { test, expect } from "@playwright/test";
test("table and Mermaid overlays are keyboard dismissible and downloads retain source and raster formats", async ({
  page,
}) => {
  await page.goto("http://localhost:5198/test/browser/?ui-parity");
  await expect(
    page.getByRole("button", { name: "Update", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const fixture = await import("/test/browser/ui-parity.tsx");
    fixture.mountUiParity();
  });
  await expect(
    page.getByRole("button", { name: "Toggle stream" }),
  ).toBeVisible();
  const table = page.locator('[data-streamdown="table-wrapper"]').first();
  await table.getByRole("button", { name: "View fullscreen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const diagram = page.locator('[data-streamdown="mermaid"]');
  await diagram.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(diagram.locator(".sd-panzoom-content")).not.toHaveCSS(
    "transform",
    "none",
  );
  await diagram
    .getByRole("button", { name: "Download diagram", exact: true })
    .click();
  const source = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download diagram as MMD" }).click();
  expect((await source).suggestedFilename()).toBe("diagram.mmd");
  await diagram
    .getByRole("button", { name: "Download diagram", exact: true })
    .click();
  const png = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download diagram as PNG" }).click();
  expect((await png).suggestedFilename()).toBe("diagram.png");
  await page.getByRole("button", { name: "external", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Open external link?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "external", exact: true }),
  ).toBeFocused();
});
