import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("native controls copy/export rendered data and reactively respect streaming and settings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          (window as any).copiedText = value;
        },
      },
      configurable: true,
    });
  });
  await page.goto("http://localhost:5198/test/browser/?controls");
  const copy = page.getByRole("button", { name: "Copy source" });
  await expect(copy.locator("[data-custom-icon]")).toHaveCount(1);
  await copy.click();
  expect(await page.evaluate(() => (window as any).copiedText)).toBe(
    "const answer = 42;",
  );
  await expect(page.getByRole("status")).toHaveText("Copied");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download file" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("file.js");
  expect(await readFile((await file.path())!, "utf8")).toBe(
    "const answer = 42;",
  );
  await page.getByRole("combobox", { name: "Copy table" }).selectOption("csv");
  await page.getByRole("button", { name: "Copy table as CSV" }).click();
  expect(await page.evaluate(() => (window as any).copiedText)).toBe(
    'Name,Value\nalpha,"a,b"',
  );
  const tableDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download table as CSV" }).click();
  const table = await tableDownload;
  expect(table.suggestedFilename()).toBe("table.csv");
  expect(await readFile((await table.path())!, "utf8")).toBe(
    'Name,Value\nalpha,"a,b"',
  );
  await page.getByRole("button", { name: "Toggle streaming" }).click();
  await expect(copy).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Download file" }),
  ).toBeDisabled();
  await expect(page.getByRole("combobox")).toBeDisabled();
  await page.getByRole("button", { name: "Toggle streaming" }).click();
  await expect(copy).toBeEnabled();
  await page.getByRole("button", { name: "Toggle controls" }).click();
  await expect(copy).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle controls" }).click();
  await expect(copy).toHaveCount(1);
  await expect(page.locator("strong")).toHaveCount(0);
  await expect(page.locator(".streamdown")).toContainText("Filtered");
  await expect(page.getByRole("link", { name: "Link" })).toHaveAttribute(
    "href",
    "/proxy?url=https%3A%2F%2Fexample.org",
  );
  expect(
    await page
      .locator("pre")
      .evaluate((element) => getComputedStyle(element).maxHeight),
  ).toBe("60px");
  await page.getByRole("button", { name: "Toggle streaming" }).click();
  await page.getByRole("button", { name: "Append lines" }).click();
  await expect
    .poll(() =>
      page
        .locator("pre")
        .evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
    )
    .toBeLessThan(2);
  await page.locator("pre").evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("button", { name: "Append lines" }).click();
  await expect
    .poll(() => page.locator("pre").evaluate((element) => element.scrollTop))
    .toBe(0);
});
