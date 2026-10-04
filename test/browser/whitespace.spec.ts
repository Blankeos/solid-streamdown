import { expect, test } from "@playwright/test";
const expectedText: Record<string, string> = {
  "underlined-link": "one two three",
  account: "Which account did you pay with?\nAnswer: GCash",
  "soft-newlines": "First line\nsecond line\nthird line",
  "emphasis-boundaries": "Before bold after italic end",
  "repeated-edge-spaces": "  leading   middle   trailing  ",
  nbsp: "one\u00a0two",
  "inline-code": "Before one two after",
  "pre-wrap-code": "one   two",
  "midword-control": "supercalifragilisticexpialidocious",
};

function measurePage() {
  function measure(root: Element) {
    const paragraph = root.querySelector("p")!;
    const origin = paragraph.getBoundingClientRect();
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const chars: Array<{
      char: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      for (let offset = 0; offset < node.textContent!.length; offset++) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        const rect = range.getBoundingClientRect();
        chars.push({
          char: node.textContent![offset],
          x: rect.x - origin.x,
          y: rect.y - origin.y,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    // Count ink-bearing lines, not newline Range rectangles or collapsed
    // edge whitespace. Narrow char-mode midword wrapping is intentional.
    const lines = new Set(
      chars
        .filter((char) => /\S/.test(char.char))
        .map((char) => Math.round(char.y)),
    ).size;
    return {
      text: paragraph.textContent,
      lines,
      height: origin.height,
      chars,
    };
  }
  return Array.from(document.querySelectorAll("[data-case]")).map((sample) => ({
    id: sample.getAttribute("data-case")!,
    animated: measure(sample.querySelector('[data-render="animated"]')!),
    settled: measure(sample.querySelector('[data-render="settled"]')!),
  }));
}

// Browser layout is the contract: text-only reveal tests cannot detect retained
// pre-wrap whitespace inside inline-block animation wrappers. No renderer seam
// or copied layout algorithm supplies the expected result.
for (const sep of ["char", "word"] as const) {
  for (const width of ["normal", "narrow"] as const) {
    test(`${sep} reveal preserves native whitespace at ${width} width`, async ({
      page,
    }, testInfo) => {
      await page.goto(
        `http://localhost:5198/test/browser/?whitespace&sep=${sep}&width=${width}`,
      );
      await expect(
        page.locator('[data-case="account"] p').first(),
      ).toBeVisible();
      // Finish actual CSS animations, without removing wrappers by switching
      // isAnimating off (which would hide the whitespace bug).
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          document.getAnimations().map((animation) => animation.finished),
        );
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      const codeSpaces = page.locator(
        '[data-case="pre-wrap-code"] [data-render="animated"] code [data-sd-animate-space]',
      );
      expect(await codeSpaces.count()).toBeGreaterThan(0);
      expect(
        await codeSpaces.evaluateAll((hosts) =>
          hosts.map((host) => ({
            display: getComputedStyle(host).display,
            whiteSpace: getComputedStyle(host).whiteSpace,
            parentWhiteSpace: getComputedStyle(host.parentElement!).whiteSpace,
          })),
        ),
      ).toEqual([
        {
          display: "inline",
          whiteSpace: "pre-wrap",
          parentWhiteSpace: "pre-wrap",
        },
      ]);
      const measurements = await page.evaluate(measurePage);
      await testInfo.attach("whitespace-range-geometry", {
        body: JSON.stringify(measurements, null, 2),
        contentType: "application/json",
      });
      for (const sample of measurements) {
        const expected = { text: expectedText[sample.id] };
        expect
          .soft(sample.animated.text, `${sample.id}: animated actual text`)
          .toBe(expected.text);
        expect
          .soft(sample.settled.text, `${sample.id}: settled actual text`)
          .toBe(expected.text);
        if (width === "normal") {
          expect
            .soft(sample.animated.lines, `${sample.id}: wide ink line count`)
            .toBe(sample.settled.lines);
          // Wide layout has no legitimate midword-wrap difference: compare all
          // per-character positions and space advances against the reference.
          const defects = sample.animated.chars.flatMap((actual, index) => {
            const reference = sample.settled.chars[index];
            if (!reference) return [{ index, actual, reference: null }];
            return (actual.height > 0 &&
              reference.height > 0 &&
              (Math.abs(actual.x - reference.x) > 0.75 ||
                Math.abs(actual.y - reference.y) > 0.75)) ||
              Math.abs(actual.width - reference.width) > 0.75
              ? [{ index, actual, reference }]
              : [];
          });
          expect
            .soft(defects, `${sample.id}: wide character Range geometry`)
            .toEqual([]);
        } else if (sample.id === "midword-control") {
          if (sep === "char") {
            expect(
              sample.animated.lines,
              "intentional char-mode midword wrapping",
            ).toBeGreaterThan(sample.settled.lines);
          } else {
            expect(
              sample.animated.lines,
              "word-mode keeps an unbroken word intact",
            ).toBe(sample.settled.lines);
          }
        } else {
          // Do not demand identical narrow line breaking. Check spaces only
          // when both renderers put the adjacent ink on the same line; a space
          // trimmed at a legitimate wrap is not a preserved-whitespace defect.
          const defects = sample.animated.chars.flatMap(
            (actual, index, chars) => {
              if (!/\s/.test(actual.char)) return [];
              const before = chars
                .slice(0, index)
                .findLast((char) => /\S/.test(char.char));
              const after = chars
                .slice(index + 1)
                .find((char) => /\S/.test(char.char));
              const refChars = sample.settled.chars;
              const refBefore = refChars
                .slice(0, index)
                .findLast((char) => /\S/.test(char.char));
              const refAfter = refChars
                .slice(index + 1)
                .find((char) => /\S/.test(char.char));
              if (
                !before ||
                !after ||
                !refBefore ||
                !refAfter ||
                Math.abs(before.y - after.y) > 1 ||
                Math.abs(refBefore.y - refAfter.y) > 1
              )
                return [];
              const reference = refChars[index];
              return Math.abs(actual.width - reference.width) > 0.75
                ? [{ index, actual, reference }]
                : [];
            },
          );
          expect
            .soft(defects, `${sample.id}: narrow same-line whitespace widths`)
            .toEqual([]);
        }
      }
      await page.getByRole("button", { name: "Settle stream" }).click();
      await expect(
        page.locator(
          '[data-render="animated"] [data-sd-animate], [data-render="animated"] [data-sd-animate-space]',
        ),
      ).toHaveCount(0);
      const afterSettle = await page.evaluate(measurePage);
      for (const sample of afterSettle) {
        expect(
          sample.animated.text,
          `${sample.id}: unchanged after live->settled`,
        ).toBe(expectedText[sample.id]);
        expect(sample.animated).toEqual(sample.settled);
      }
    });
  }
}

// This control explicitly identifies the shaping difference, rather than
// hiding it by increasing the whitespace geometry tolerance.
test("atomic transform hosts break cross-boundary Arial kerning, not newline collapse", async ({
  page,
}, testInfo) => {
  await page.goto("http://localhost:5198/test/browser/?whitespace&sep=char");
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished),
    );
    document
      .querySelectorAll<HTMLElement>(".whitespace-render")
      .forEach((root) => (root.style.fontKerning = "auto"));
  });
  const kerned = (await page.evaluate(measurePage)).find(
    (sample) => sample.id === "account",
  )!;
  const index = kerned.animated.text!.indexOf("\n");
  expect(kerned.animated.text).toBe(kerned.settled.text);
  expect(
    Math.abs(
      kerned.animated.chars[index].width - kerned.settled.chars[index].width,
    ),
  ).toBeGreaterThan(0.75);
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>(".whitespace-render")
      .forEach((root) => (root.style.fontKerning = "none"));
  });
  const unkerned = (await page.evaluate(measurePage)).find(
    (sample) => sample.id === "account",
  )!;
  expect(
    Math.abs(
      unkerned.animated.chars[index].width -
        unkerned.settled.chars[index].width,
    ),
  ).toBeLessThanOrEqual(0.75);
  await testInfo.attach("kerning-control", {
    body: JSON.stringify(
      {
        kerned: {
          animated: kerned.animated.chars[index],
          settled: kerned.settled.chars[index],
        },
        unkerned: {
          animated: unkerned.animated.chars[index],
          settled: unkerned.settled.chars[index],
        },
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

for (const sep of ["char", "word"] as const) {
  test(`${sep} inline fade hosts preserve native kerning within existing geometry tolerance`, async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:5198/test/browser/?whitespace&inline&sep=${sep}`,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        document.getAnimations().map((animation) => animation.finished),
      );
    });
    for (const sample of await page.evaluate(measurePage)) {
      expect(sample.animated.text).toBe(expectedText[sample.id]);
      expect(sample.animated.lines).toBe(sample.settled.lines);
      expect(sample.animated.height).toBe(sample.settled.height);
      // Inline element boundaries still quantize individual advances in Chromium;
      // keep the SAME 0.75px contract, not bit-identical floating point ranges.
      sample.animated.chars.forEach((actual, index) => {
        const reference = sample.settled.chars[index];
        // A collapsed edge has an empty Range at a document-dependent origin;
        // only its zero width is meaningful (same rule as the atomic case).
        const axes =
          actual.height > 0 && reference.height > 0
            ? (["x", "y", "width"] as const)
            : (["width"] as const);
        for (const axis of axes) {
          expect(
            Math.abs(actual[axis] - reference[axis]),
            `${sample.id}: ${index} ${axis}`,
          ).toBeLessThanOrEqual(0.75);
        }
      });
    }
  });
}

test("reduced motion makes whitespace and glyph hosts immediately visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "http://localhost:5198/test/browser/?whitespace&timing&sep=word",
  );
  const hosts = await page
    .locator(
      '[data-render="animated"] [data-sd-animate], [data-render="animated"] [data-sd-animate-space]',
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        space: element.hasAttribute("data-sd-animate-space"),
        opacity: getComputedStyle(element).opacity,
        animation: getComputedStyle(element).animationName,
        transform: getComputedStyle(element).transform,
      })),
    );
  expect(hosts.some((host) => host.space)).toBe(true);
  expect(hosts.some((host) => !host.space)).toBe(true);
  for (const host of hosts) {
    expect(host.opacity).toBe("1");
    expect(host.animation).toBe("none");
    expect(host.transform).toBe("none");
  }
  for (const sample of await page.evaluate(measurePage)) {
    expect(sample.animated.text).toBe(expectedText[sample.id]);
  }
});

test("underlined link whitespace reveals with its preceding token, never early", async ({
  page,
}) => {
  await page.goto(
    "http://localhost:5198/test/browser/?whitespace&timing&sep=word",
  );
  const result = await page
    .locator('[data-case="underlined-link"] [data-render="animated"] a')
    .evaluate(async (link) => {
      const glyph = Array.from(
        link.querySelectorAll<HTMLElement>("[data-sd-animate]"),
      ).find((element) => element.textContent === "two")!;
      const space = glyph.nextElementSibling as HTMLElement;
      const glyphAnimation = glyph.getAnimations()[0];
      const spaceAnimation = space.getAnimations()[0];
      const glyphTiming = glyphAnimation.effect!.getTiming();
      const spaceTiming = spaceAnimation.effect!.getTiming();
      // Drive actual browser CSS animations deterministically, not mocked styles
      // or timeouts that may sample after the reveal on a slow CI machine.
      glyphAnimation.pause();
      spaceAnimation.pause();
      async function sample(time: number) {
        glyphAnimation.currentTime = time;
        spaceAnimation.currentTime = time;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return {
          glyph: Number(getComputedStyle(glyph).opacity),
          space: Number(getComputedStyle(space).opacity),
        };
      }
      return {
        text: link.textContent,
        decoration: getComputedStyle(link).textDecorationLine,
        isSpace: space.hasAttribute("data-sd-animate-space"),
        spaceText: space.textContent,
        glyphTiming,
        spaceTiming,
        before: await sample(glyphTiming.delay - 1),
        during: await sample(glyphTiming.delay + 500),
        after: await sample(glyphTiming.delay + 1000),
      };
    });
  expect(result.text).toBe("one two three");
  expect(result.decoration).toContain("underline");
  expect(result.isSpace).toBe(true);
  expect(result.spaceText).toBe(" ");
  expect(result.glyphTiming.delay).toBeGreaterThan(0);
  expect(result.spaceTiming.delay).toBe(result.glyphTiming.delay);
  expect(result.spaceTiming.duration).toBe(result.glyphTiming.duration);
  expect(result.before).toEqual({ glyph: 0, space: 0 });
  expect(result.during.glyph).toBeGreaterThan(0);
  expect(result.during.glyph).toBeLessThan(1);
  expect(result.during.space).toBeCloseTo(result.during.glyph, 5);
  expect(result.after).toEqual({ glyph: 1, space: 1 });
});

for (const sep of ["char", "word"] as const) {
  test(`${sep} whitespace keeps its live Animation object across append`, async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:5198/test/browser/?whitespace&timing&sep=${sep}`,
    );
    const space = page
      .locator(
        '[data-case="account"] [data-render="animated"] [data-sd-animate-space]',
      )
      .first();
    const host = await space.elementHandle();
    expect(host).not.toBeNull();
    const animation = await host!.evaluateHandle((element) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      animation.currentTime = Number(animation.effect!.getTiming().delay) + 400;
      return animation;
    });
    const before = await animation.evaluate((animation) => ({
      currentTime: animation.currentTime,
      duration: animation.effect!.getTiming().duration,
    }));
    await page.getByRole("button", { name: "Append stream" }).click();
    await expect(
      page.locator('[data-case="account"] [data-render="animated"] p'),
    ).toHaveText("Which account did you pay with? Answer: GCash today");
    expect(
      await space.evaluate((element, previous) => element === previous, host!),
    ).toBe(true);
    expect(
      await host!.evaluate(
        (element, previous) => element.getAnimations()[0] === previous,
        animation,
      ),
    ).toBe(true);
    expect(
      await animation.evaluate((animation) => ({
        currentTime: animation.currentTime,
        duration: animation.effect!.getTiming().duration,
      })),
    ).toEqual(before);
    await animation.dispose();
    await host!.dispose();
  });
}

test("ancestor link underline paints over whitespace only after reveal", async ({
  page,
}, testInfo) => {
  await page.goto(
    "http://localhost:5198/test/browser/?whitespace&timing&sep=word",
  );
  const link = page.locator(
    '[data-case="underlined-link"] [data-render="animated"] a',
  );
  await link.scrollIntoViewIfNeeded();
  const clip = await link.evaluate(async (link) => {
    await document.fonts.ready;
    const root = link.closest<HTMLElement>(".whitespace-render")!;
    root.style.background = "white";
    const anchor = link as HTMLElement;
    anchor.style.color = "black";
    anchor.style.textDecorationThickness = "2px";
    anchor.style.textUnderlineOffset = "2px";
    for (const animation of link.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = 0;
    }
    const glyph = Array.from(link.querySelectorAll("[data-sd-animate]")).find(
      (element) => element.textContent === "two",
    )!;
    const space = glyph.nextElementSibling!;
    const range = document.createRange();
    range.selectNodeContents(space);
    const rect = range.getBoundingClientRect();
    const paragraph = root.querySelector("p")!.getBoundingClientRect();
    // Only sample the interior of the space, never neighboring glyph ink.
    return {
      x: Math.floor(rect.x + rect.width / 2),
      y: Math.floor(paragraph.y),
      width: 2,
      height: Math.floor(paragraph.height),
    };
  });
  async function paintedPixels() {
    const png = await page.screenshot({ clip, animations: "allow" });
    // Decode the real screenshot with the browser's PNG decoder; no dependency
    // or screenshot-baseline comparison substitutes for the paint assertion.
    const ink = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let ink = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (
          pixels[offset] < 250 ||
          pixels[offset + 1] < 250 ||
          pixels[offset + 2] < 250
        )
          ink++;
      }
      return ink;
    }, png.toString("base64"));
    return { png, ink };
  }
  const before = await paintedPixels();
  await link.evaluate((link) => {
    for (const animation of link.getAnimations({ subtree: true })) {
      animation.finish();
    }
  });
  const after = await paintedPixels();
  await testInfo.attach("space-before-reveal", {
    body: before.png,
    contentType: "image/png",
  });
  await testInfo.attach("space-after-reveal", {
    body: after.png,
    contentType: "image/png",
  });
  expect(before.ink, "no ancestor underline ink before reveal").toBe(0);
  expect(
    after.ink,
    "positive control: revealed underline actually paints",
  ).toBeGreaterThan(0);
});
