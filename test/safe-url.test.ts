import { describe, expect, it } from "vitest";
import {
  defaultSafeUrlTransform,
  isSafeUrl,
  sanitizeSrcset,
} from "../src/safe-url";

describe("isSafeUrl", () => {
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "javascript:alert(1)  ",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<h1>hi</h1>",
    "data:image/png;base64,AAA",
    "vbscript:msgbox(1)",
    "VBSCRIPT:msgbox(1)",
    "blob:https://example.com/uuid",
    "file:///etc/passwd",
    "ftp://example.com/file",
  ])("rejects dangerous URL %j", (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it.each([
    "https://example.com",
    "http://example.com/path?q=1#frag",
    "mailto:hello@example.com",
    "tel:+15551234567",
    "HTTPS://EXAMPLE.COM",
    "/relative/path",
    "./relative.png",
    "../up.png",
    "page.md",
    "images/photo.jpg",
    "#fragment",
    "?query=1",
    "//example.com/protocol-relative",
    "streamdown:incomplete-link",
    "streamdown:incomplete-image",
  ])("allows safe or relative URL %j", (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it("rejects empty and non-string input", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("   ")).toBe(false);
    expect(isSafeUrl(undefined as unknown as string)).toBe(false);
  });
});

describe("defaultSafeUrlTransform", () => {
  it("keeps safe URLs untouched", () => {
    expect(defaultSafeUrlTransform("https://example.com")).toBe(
      "https://example.com",
    );
  });

  it("drops unsafe URLs", () => {
    expect(defaultSafeUrlTransform("javascript:alert(1)")).toBeUndefined();
    expect(defaultSafeUrlTransform("data:text/html,x")).toBeUndefined();
  });
});

describe("sanitizeSrcset", () => {
  it("keeps safe candidates", () => {
    expect(sanitizeSrcset("a.jpg 1x, b.jpg 2x")).toBe("a.jpg 1x, b.jpg 2x");
  });

  it("drops unsafe candidates but keeps safe ones", () => {
    expect(sanitizeSrcset("a.jpg 1x, javascript:alert(1) 2x")).toBe("a.jpg 1x");
  });

  it("returns undefined when nothing safe remains", () => {
    expect(sanitizeSrcset("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeSrcset("")).toBeUndefined();
  });
});
