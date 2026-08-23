import { describe, expect, it } from "vitest";
import { isOpenableLink } from "./jobLink.js";

describe("isOpenableLink", () => {
  it.each([
    "https://example.com/jobs/1",
    "http://example.com",
    "HTTPS://EXAMPLE.COM",
    "  https://example.com  ",
  ])("accepts %s", (value) => {
    expect(isOpenableLink(value)).toBe(true);
  });

  it.each([
    ["a relative path", "example.com/jobs/1"],
    ["a protocol-relative URL", "//example.com"],
    ["empty", ""],
    ["whitespace", "   "],
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
  ])("rejects %s", (_label, value) => {
    expect(isOpenableLink(value)).toBe(false);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<h1>hi</h1>"],
    ["file:", "file:///etc/passwd"],
  ])("rejects the %s scheme", (_label, value) => {
    expect(isOpenableLink(value)).toBe(false);
  });

  it("is not fooled by a scheme split across a newline", () => {
    // The URL parser strips ASCII tab and newline before reading the scheme,
    // so this is javascript: however it is spelled. A regex on the raw string
    // would let it through, which is why the parser is used instead.
    const value = "java" + String.fromCharCode(10) + "script:alert(1)";
    expect(isOpenableLink(value)).toBe(false);
  });
});
