import { describe, expect, it, vi } from "vitest";
import { convertDocx, DocxError, DOCX_TYPE, MAX_BYTES } from "./docx.js";

// Every refusal below is caught before the converter is reached, except the
// last one — which is about how *this* module wraps a failure from mammoth,
// not about mammoth's zip reader.
//
// It is mocked because mammoth is built on bluebird, which reports a rejection
// from inside its own chain as unhandled no matter what the caller attaches,
// and vitest fails the whole run on an unhandled rejection. Real conversion is
// verified against a real .docx in the browser instead.
vi.mock("mammoth", () => ({
  convertToHtml: vi.fn(() => Promise.reject(new Error("Could not find file in options"))),
}));
import { sanitiseHtml, toDisplayHtml, htmlToText } from "./coverLetter.js";

const file = (name, type, bytes = 10) =>
  Object.defineProperty(new File(["x"], name, { type }), "size", {
    value: bytes,
  });

describe("convertDocx refuses before spending the conversion", () => {
  it("refuses a PDF, and says what to do instead", async () => {
    // A PDF is a rendering of the .docx, with the structure already discarded.
    await expect(
      convertDocx(file("letter.pdf", "application/pdf"))
    ).rejects.toThrow(/not a \.docx/i);
  });

  it("points at pasting rather than just saying no", async () => {
    await expect(
      convertDocx(file("letter.pdf", "application/pdf"))
    ).rejects.toThrow(/paste/i);
  });

  it("accepts a .docx by extension when the browser gives no type", async () => {
    // Refused later for its contents, not its name — which is the point: the
    // name check must not be what rejects a real document.
    await expect(convertDocx(file("letter.docx", ""))).rejects.toThrow(
      /not a readable \.docx/i
    );
  });

  it("refuses something that is not a ZIP before the converter sees it", async () => {
    // A .docx always starts "PK". Checking here gives a message worth reading
    // and keeps mammoth off the path for input that cannot possibly work —
    // which also avoids the unhandled rejection its promise chain leaves
    // behind, and which vitest fails the run over.
    await expect(
      convertDocx(file("letter.docx", DOCX_TYPE))
    ).rejects.toThrow(/not a readable \.docx/i);
  });

  it("wraps a converter failure rather than leaking it raw", async () => {
    // 22 bytes: an empty ZIP central directory. Gets past the magic check, so
    // the converter is reached and its rejection has to come back as a
    // DocxError the field can display.
    const empty = new Uint8Array(22);
    empty.set([0x50, 0x4b, 0x05, 0x06]);
    const zip = Object.defineProperty(
      new File([empty], "letter.docx", { type: DOCX_TYPE }),
      "size",
      { value: 22 }
    );
    const err = await convertDocx(zip).catch((e) => e);
    expect(err).toBeInstanceOf(DocxError);
    expect(err.message).toMatch(/could not read/i);
  });

  it("refuses a file too large to be a one-page letter", async () => {
    await expect(
      convertDocx(file("letter.docx", DOCX_TYPE, MAX_BYTES + 1))
    ).rejects.toThrow(/images/i);
  });

  it("refuses nothing at all", async () => {
    await expect(convertDocx(null)).rejects.toBeInstanceOf(DocxError);
  });

});

describe("sanitiseHtml", () => {
  it("keeps the elements mammoth actually emits", () => {
    const html =
      "<p>Dear <strong>all</strong>,</p><ul><li>One</li></ul><h1>Head</h1>";
    expect(sanitiseHtml(html)).toBe(html);
  });

  it("drops images, which is what keeps base64 out of the database", () => {
    // mammoth inlines embedded images as data URIs by default, so a letterhead
    // logo would turn a 2 KB column into 100 KB+ and land in every backup.
    const html = '<p>Hi</p><img src="data:image/png;base64,AAAA">';
    const clean = sanitiseHtml(html);
    expect(clean).not.toContain("img");
    expect(clean).not.toContain("data:");
    expect(clean).toContain("<p>Hi</p>");
  });

  it("removes a script tag and its contents", () => {
    const clean = sanitiseHtml("<p>Hi</p><script>alert(1)</script>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("alert");
  });

  it("removes every attribute except a safe href", () => {
    const clean = sanitiseHtml('<p class="x" onclick="alert(1)">Hi</p>');
    expect(clean).toBe("<p>Hi</p>");
  });

  it("keeps an http link but drops a javascript one", () => {
    expect(sanitiseHtml('<a href="https://example.com">x</a>')).toContain(
      'href="https://example.com"'
    );
    const clean = sanitiseHtml('<a href="javascript:alert(1)">x</a>');
    expect(clean).not.toContain("javascript");
    expect(clean).toBe("<a>x</a>");
  });

  it("unwraps an unknown element rather than losing its text", () => {
    // Dropping the text with the tag would silently eat part of the letter.
    expect(sanitiseHtml("<div><p>Kept</p></div>")).toBe("<p>Kept</p>");
    expect(sanitiseHtml("<span>Kept</span>")).toBe("Kept");
  });

  it("survives an event handler hidden in an unknown element", () => {
    const clean = sanitiseHtml('<marquee onstart="alert(1)"><p>Hi</p></marquee>');
    expect(clean).not.toContain("onstart");
    expect(clean).toBe("<p>Hi</p>");
  });
});

describe("toDisplayHtml reconciles prose and HTML", () => {
  it("passes converted HTML through the sanitiser", () => {
    expect(toDisplayHtml('<p onclick="x">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("wraps plain prose into paragraphs", () => {
    expect(toDisplayHtml("One\n\nTwo")).toBe("<p>One</p>\n<p>Two</p>");
  });

  it("escapes prose that happens to contain markup", () => {
    // Anything not recognised as our HTML is treated as text, so a letter
    // mentioning a tag shows the tag rather than running it.
    expect(toDisplayHtml("I wrote <b>bold</b> once")).toContain("&lt;b&gt;");
  });

  it("keeps a single newline as a break inside its paragraph", () => {
    expect(toDisplayHtml("Sincerely,\nNick")).toBe("<p>Sincerely,<br>Nick</p>");
  });

  it("is empty for nothing", () => {
    expect(toDisplayHtml("")).toBe("");
    expect(toDisplayHtml(null)).toBe("");
    expect(toDisplayHtml("   ")).toBe("");
  });
});

describe("htmlToText", () => {
  it("turns paragraphs back into blank-line-separated prose", () => {
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\n\nTwo");
  });

  it("turns a break back into a single newline", () => {
    expect(htmlToText("<p>Sincerely,<br>Nick</p>")).toBe("Sincerely,\nNick");
  });

  it("drops formatting, which is why the control says Edit as text", () => {
    expect(htmlToText("<p>Dear <strong>all</strong></p>")).toBe("Dear all");
  });

  it("leaves prose alone", () => {
    expect(htmlToText("Already plain")).toBe("Already plain");
  });

  it("is empty for nothing", () => {
    expect(htmlToText(null)).toBe("");
  });
});
