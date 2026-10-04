import { test, expect } from "@playwright/test";
async function fixture(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:5198/test/browser/");
  await expect(
    page.getByRole("button", { name: "Update", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const fixture = await import("/test/browser/scheduling-parity.tsx");
    fixture.mountSchedulingParity();
  });
}
test("fullscreen retains custom handlers, live rows and the same table after closing", async ({
  page,
}) => {
  await fixture(page);
  const table = page.locator('[data-streamdown="table"]');
  await table.evaluate((el) => el.setAttribute("data-original", "yes"));
  await page
    .locator('[data-streamdown="table-wrapper"]')
    .getByRole("button", { name: "View fullscreen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Count 0" }).click();
  await expect(dialog.getByRole("button", { name: "Count 1" })).toBeVisible();
  // Update reactive rows while the controls are behind the modal.
  await page
    .getByRole("button", { name: "Append rows" })
    .evaluate((el: HTMLButtonElement) => el.click());
  await expect(dialog.locator("tr")).toHaveCount(22);
  await expect(dialog.locator("table")).toHaveAttribute("data-original", "yes");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(table).toHaveAttribute("data-original", "yes");
  await table.getByRole("button", { name: "Count 1" }).click();
  await expect(table.getByRole("button", { name: "Count 2" })).toBeVisible();
});
test("fits ancestor height caps, clamps wheel zoom, pans by pointer and resets after resize", async ({
  page,
}) => {
  await fixture(page);
  const fit = page.locator("[data-fit-fixture]");
  const content = fit.locator(".sd-panzoom-content");
  await expect(fit.locator(".sd-panzoom-viewport")).toHaveCSS(
    "height",
    "160px",
  );
  await expect(content).toHaveCSS("transform", "matrix(0.2, 0, 0, 0.2, 0, 0)");
  await expect(
    fit.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeDisabled();
  await fit
    .locator(".sd-panzoom-viewport")
    .dispatchEvent("wheel", { deltaY: -100 });
  await expect(content).toHaveCSS("transform", "matrix(0.3, 0, 0, 0.3, 0, 0)");
  for (let i = 0; i < 10; i++)
    await fit
      .locator(".sd-panzoom-viewport")
      .dispatchEvent("wheel", { deltaY: -100 });
  await expect(
    fit.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeDisabled();
  const bounds = await fit.locator(".sd-panzoom-viewport").boundingBox();
  await page.mouse.move(bounds!.x + 100, bounds!.y + 50);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 140, bounds!.y + 70);
  await page.mouse.up();
  await expect(content).toHaveCSS(
    "transform",
    "matrix(0.8, 0, 0, 0.8, 40, 20)",
  );
  await page.getByRole("button", { name: "Narrow", exact: true }).click();
  await expect(content).toHaveCSS(
    "transform",
    "matrix(0.8, 0, 0, 0.8, 40, 20)",
  );
  await fit
    .getByRole("button", { name: "Reset zoom and pan", exact: true })
    .click();
  await expect(content).toHaveCSS("transform", "matrix(0.2, 0, 0, 0.2, 0, 0)");
});
test("offscreen Mermaid skips work and renders the latest diagram on visibility", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: "Update diagram" }).click();
  await page.waitForTimeout(650);
  await expect(page.locator("[data-render-count]")).toHaveText("0");
  await page.locator("[data-offscreen]").scrollIntoViewIfNeeded();
  await expect(
    page.locator("[data-offscreen] .sd-panzoom-content svg"),
  ).toContainText("latest");
  await expect(page.locator("[data-render-count]")).toHaveText("1");
});
test("stream pin is batched, respects manual unpin across restart and permits repin", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: "Toggle streaming" }).click();
  await page.getByRole("button", { name: "Append rows" }).click();
  const scroll = page.locator('[data-streamdown="table-wrapper"] .sd-scroll');
  const distance = () =>
    scroll.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
  await expect.poll(distance).toBeLessThan(8);
  await scroll.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("button", { name: "Toggle streaming" }).click();
  await page.getByRole("button", { name: "Toggle streaming" }).click();
  await page.getByRole("button", { name: "Append rows" }).click();
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0);
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("button", { name: "Append rows" }).click();
  await expect.poll(distance).toBeLessThan(8);
  const stable = await scroll.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(200);
  expect(await scroll.evaluate((el) => el.scrollTop)).toBe(stable);
});

for (const mode of ["global", "panZoom"] as const) {
  test(`${mode} hidden Mermaid buttons retain fit, wheel and pointer navigation`, async ({
    page,
  }) => {
    await fixture(page);
    const diagram = page.locator(`[data-mermaid-controls="${mode}"]`);
    await diagram.scrollIntoViewIfNeeded();
    const viewport = diagram.locator(".sd-panzoom-viewport");
    const content = diagram.locator(".sd-panzoom-content");
    await expect(viewport).toHaveCSS("height", "200px");
    await expect(content).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await expect(
      diagram.getByRole("button", { name: "Zoom in", exact: true }),
    ).toHaveCount(0);
    await expect(
      diagram.getByRole("button", { name: "Zoom out", exact: true }),
    ).toHaveCount(0);
    await expect(
      diagram.getByRole("button", { name: "Reset zoom and pan", exact: true }),
    ).toHaveCount(0);
    for (let i = 0; i < 12; i++)
      await viewport.dispatchEvent("wheel", { deltaY: 100 });
    await expect(content).toHaveCSS(
      "transform",
      "matrix(0.1, 0, 0, 0.1, 0, 0)",
    );
    const bounds = await viewport.boundingBox();
    await page.mouse.move(bounds!.x + 100, bounds!.y + 50);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + 140, bounds!.y + 70);
    await page.mouse.up();
    await expect(content).toHaveCSS(
      "transform",
      "matrix(0.1, 0, 0, 0.1, 40, 20)",
    );
    if (mode === "global") {
      await expect(diagram.getByRole("button")).toHaveCount(0);
    } else {
      await diagram
        .getByRole("button", { name: "Download diagram", exact: true })
        .click();
      const download = page.waitForEvent("download");
      await diagram
        .getByRole("menuitem", { name: "Download diagram as SVG", exact: true })
        .click();
      expect((await download).suggestedFilename()).toBe("diagram.svg");
      await diagram
        .getByRole("button", { name: "View fullscreen", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator(".sd-mermaid-svg svg")).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Zoom out", exact: true }),
      ).toHaveCount(0);
      for (let i = 0; i < 12; i++)
        await dialog
          .locator(".sd-panzoom-viewport")
          .dispatchEvent("wheel", { deltaY: 100 });
      await expect(dialog.locator(".sd-panzoom-content")).toHaveCSS(
        "transform",
        "matrix(0.1, 0, 0, 0.1, 0, 0)",
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
}
test("Mermaid zoom buttons reach the 0.1 floor and reset to fitted size", async ({
  page,
}) => {
  await fixture(page);
  const diagram = page.locator('[data-mermaid-controls="enabled"]');
  await diagram.scrollIntoViewIfNeeded();
  const out = diagram.getByRole("button", { name: "Zoom out", exact: true });
  await expect(diagram.locator(".sd-panzoom-content")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  for (let i = 0; i < 10; i++) {
    if (await out.isEnabled()) await out.click();
  }
  await expect(out).toBeDisabled();
  await expect(diagram.locator(".sd-panzoom-content")).toHaveCSS(
    "transform",
    "matrix(0.1, 0, 0, 0.1, 0, 0)",
  );
  await diagram
    .getByRole("button", { name: "Reset zoom and pan", exact: true })
    .click();
  await expect(diagram.locator(".sd-panzoom-content")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});
