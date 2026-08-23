import { downloadFile, slug } from "./download.js";

/**
 * Renders the stored cover letter as a small HTML document (KAN-40).
 *
 * The field holds plain text, and the HTML is generated from it here rather
 * than stored. That is what keeps this safe without a sanitiser: every
 * character of user input goes through escapeHtml, so there is nothing
 * persisted that could execute and nothing rendered that was not built here.
 *
 * HTML rather than the raw .txt because it is what opens in Word or Google
 * Docs with the paragraphs and typography intact, ready to export as the PDF
 * that gets attached to an application. Measured at roughly 1.5 KB for a
 * one-page letter, against 40-80 KB for the same thing as a PDF.
 */
const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function coverLetterHtml(text, company) {
  // A blank line separates paragraphs; a single newline is a line break within
  // one, which is what an address block or a sign-off relies on.
  const paragraphs = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `  <p>${escapeHtml(block).replace(/\n/g, "<br>\n     ")}</p>`)
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
${paragraphs}
</body>
</html>
`;
}

export const coverLetterFilename = (company) =>
  `cover-letter-${slug(company)}.html`;

export function downloadCoverLetter(text, company) {
  downloadFile(
    coverLetterHtml(text, company),
    coverLetterFilename(company),
    "text/html;charset=utf-8"
  );
}
