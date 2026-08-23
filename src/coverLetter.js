import { downloadFile, slug } from "./download.js";

/**
 * The cover letter column holds HTML once a .docx has been converted into it
 * (KAN-41), and plain prose before that — a letter typed or pasted straight
 * into the box, or anything stored before KAN-41 shipped.
 *
 * `toDisplayHtml` is the single place that reconciles the two, so nothing else
 * has to know which it is holding. There is no format flag on the row and no
 * migration: `Text` holds both, and the ambiguity is resolved on read.
 */

// mammoth emits a small, known set of elements. Anything outside it is dropped
// rather than trusted — "constrained by the converter" is not "sanitised", and
// the column is writable through the API by anything at all.
//
// IMG is deliberately absent, and that is load-bearing: mammoth inlines
// embedded images as base64 data URIs, so a letterhead logo would turn a 2 KB
// column into 100 KB+ and then sit in every nightly backup forever. Dropping
// it here is what keeps that out of the database.
const ALLOWED = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "SUP", "SUB",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI",
  "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
  "A",
]);

// Removed with their contents rather than unwrapped: whatever is inside them
// is not prose.
const DROP_WITH_CONTENTS = new Set([
  "SCRIPT", "STYLE", "IMG", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "SVG",
]);

const SAFE_HREF = /^(https?:|mailto:)/i;

function cleanElement(element) {
  // Depth first, so a child is already clean before its parent is unwrapped.
  for (const child of [...element.children]) cleanElement(child);

  const tag = element.tagName;
  if (DROP_WITH_CONTENTS.has(tag)) {
    element.remove();
    return;
  }

  // Every attribute goes unless explicitly kept. That is what removes onclick
  // and friends without needing to enumerate them.
  for (const attr of [...element.attributes]) {
    const keep =
      tag === "A" && attr.name === "href" && SAFE_HREF.test(attr.value);
    if (!keep) element.removeAttribute(attr.name);
  }

  if (!ALLOWED.has(tag)) element.replaceWith(...element.childNodes);
}

export function sanitiseHtml(html) {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html"
  );
  for (const child of [...doc.body.children]) cleanElement(child);
  return doc.body.innerHTML;
}

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Plain prose to paragraphs. A blank line separates paragraphs; a single
 * newline is a break within one, which is what an address block and a sign-off
 * rely on.
 */
export function paragraphsFromText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// Only has to be right about content this app produced. Anything else falls
// through to the escaped-text path, which renders a stray "<p" as literal
// characters — wrong-looking at worst, never unsafe, since both branches end
// up sanitised or escaped.
const LOOKS_LIKE_HTML = /<(p|div|ul|ol|h[1-6]|table|strong|em|br)\b/i;

export function toDisplayHtml(stored) {
  const text = String(stored || "");
  if (!text.trim()) return "";
  return LOOKS_LIKE_HTML.test(text)
    ? sanitiseHtml(text)
    : paragraphsFromText(text);
}

/**
 * Back to prose, for editing by hand and for the CSV export.
 *
 * Lossy on purpose — bold and lists do not survive — so the control that uses
 * it says "Edit as text" rather than pretending otherwise.
 */
export function htmlToText(stored) {
  const text = String(stored || "");
  if (!text.trim()) return "";
  if (!LOOKS_LIKE_HTML.test(text)) return text;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${sanitiseHtml(text)}</body>`,
    "text/html"
  );
  return [...doc.body.children]
    .map((block) => {
      const clone = block.cloneNode(true);
      for (const br of clone.querySelectorAll("br")) br.replaceWith("\n");
      return clone.textContent.replace(/[ \t]+\n/g, "\n").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The letter as a small standalone document.
 *
 * Opens in Word or Google Docs with paragraphs and typography intact, ready to
 * export as the PDF that gets attached to an application. Roughly 1.5 KB for a
 * one-page letter, against 40-80 KB for the same thing as a PDF.
 */
export function coverLetterHtml(stored, company) {
  const body = toDisplayHtml(stored)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  const title = company ? `Cover letter — ${company}` : "Cover letter";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font: 12pt/1.6 Georgia, "Times New Roman", serif;
         max-width: 40em; margin: 3em auto; padding: 0 1.5em; color: #111; }
  p { margin: 0 0 1em; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export const coverLetterFilename = (company) =>
  `cover-letter-${slug(company)}.html`;

export function downloadCoverLetter(stored, company) {
  downloadFile(
    coverLetterHtml(stored, company),
    coverLetterFilename(company),
    "text/html;charset=utf-8"
  );
}
