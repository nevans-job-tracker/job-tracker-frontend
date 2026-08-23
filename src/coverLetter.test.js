import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coverLetterHtml,
  coverLetterFilename,
  downloadCoverLetter,
} from "./coverLetter.js";
import { slug } from "./download.js";

const LETTER = "Dear Hiring Manager,\n\nI am writing to apply.\n\nSincerely,\nNick";

describe("coverLetterHtml", () => {
  it("turns blank-line-separated blocks into paragraphs", () => {
    const html = coverLetterHtml(LETTER, "Acme Corp");
    expect(html.match(/<p>/g)).toHaveLength(3);
  });

  it("keeps a single newline as a line break inside its paragraph", () => {
    // The sign-off relies on this: "Sincerely," and the name are one block.
    const html = coverLetterHtml(LETTER, "Acme Corp");
    expect(html).toMatch(/Sincerely,<br>\s*Nick/);
  });

  it("escapes the text rather than trusting it", () => {
    // The column holds plain text, so anything that looks like markup is
    // content. Generating the HTML here is what makes a sanitiser unnecessary.
    const html = coverLetterHtml("<script>alert(1)</script>", "Acme");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes the company name in the title too", () => {
    const html = coverLetterHtml("Hello", 'Acme " & <Co>');
    expect(html).toContain("<title>Cover letter — Acme &quot; &amp; &lt;Co&gt;</title>");
  });

  it("names the document after the company", () => {
    expect(coverLetterHtml("Hello", "Acme Corp")).toContain(
      "<title>Cover letter — Acme Corp</title>"
    );
  });

  it("falls back to a plain title with no company", () => {
    expect(coverLetterHtml("Hello", "")).toContain("<title>Cover letter</title>");
  });

  it("drops empty blocks rather than emitting hollow paragraphs", () => {
    const html = coverLetterHtml("One\n\n\n\n   \n\nTwo", "Acme");
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it("normalises CRLF, which is what a paste from Word carries", () => {
    const html = coverLetterHtml("One\r\n\r\nTwo", "Acme");
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).not.toContain("\r");
  });

  it("is a complete document a word processor will open", () => {
    const html = coverLetterHtml(LETTER, "Acme");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("</html>");
  });

  it("stays small — the whole reason for not storing a PDF", () => {
    // ~1.5 KB against 40-80 KB for the same letter as a PDF.
    expect(coverLetterHtml(LETTER, "Acme Corp").length).toBeLessThan(1200);
  });

  it("produces a document even from nothing", () => {
    expect(coverLetterHtml("", "Acme")).toContain("<body>");
  });
});

describe("coverLetterFilename", () => {
  it.each([
    ["Acme Corp", "cover-letter-acme-corp.html"],
    ["Symetra Financial", "cover-letter-symetra-financial.html"],
    ["AT&T / Bell", "cover-letter-at-t-bell.html"],
    ["  Spaced  ", "cover-letter-spaced.html"],
    ["", "cover-letter-application.html"],
    [null, "cover-letter-application.html"],
  ])("turns %s into %s", (company, expected) => {
    expect(coverLetterFilename(company)).toBe(expected);
  });

  it("never leaves a character a filesystem would object to", () => {
    expect(slug('a/b\\c:d*e?f"g<h>i|j')).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("downloadCoverLetter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hands over an HTML document under the company's name", () => {
    const captured = [];
    vi.stubGlobal(
      "Blob",
      class {
        constructor(parts, options) {
          captured.push({ text: parts.join(""), type: options && options.type });
        }
      }
    );
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL });
    const click = vi.fn();
    const created = [];
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") {
        el.click = click;
        created.push(el);
      }
      return el;
    });

    downloadCoverLetter(LETTER, "Acme Corp");

    expect(captured[0].type).toBe("text/html;charset=utf-8");
    expect(captured[0].text).toContain("<p>Dear Hiring Manager,</p>");
    expect(created[0].download).toBe("cover-letter-acme-corp.html");
    expect(click).toHaveBeenCalled();
    // Left in the DOM, an anchor would accumulate on every download.
    expect(document.body.contains(created[0])).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    spy.mockRestore();
  });
});
