import { sanitiseHtml } from "./coverLetter.js";

/**
 * Converts a .docx cover letter to HTML, in the browser (KAN-41).
 *
 * Nothing here touches the server. The file is read, converted and discarded
 * client-side, and only the resulting HTML goes out through the ordinary
 * PATCH. That is not a shortcut — it means there is no upload endpoint, no
 * multipart handling, no CPU on a single-core 1.6 GHz box, and the file
 * *structurally* never reaches the machine rather than being kept off it by
 * policy.
 *
 * mammoth is loaded with a dynamic import so Vite code-splits it out. It is
 * 621 KB minified — three times the whole rest of the app — and someone who
 * never uploads a .docx never downloads a byte of it.
 *
 * .docx only, deliberately. A .docx is structured XML: paragraphs, bold runs
 * and lists exist as data, and mammoth maps Word *styles* to semantic elements
 * rather than copying inline formatting. A PDF is positioned glyphs with no
 * structure at all — paragraph breaks would be guessed, bold would be gone,
 * and a letterhead would land in the body as prose. If only a PDF exists,
 * open it and paste: the viewer already does that extraction, for no bytes.
 */

export const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class DocxError extends Error {}

// A one-page letter is a few tens of KB. Well past that and it is either not a
// cover letter or it is stuffed with images, and either way it is worth saying
// so before spending the conversion.
export const MAX_BYTES = 2 * 1024 * 1024;

export async function convertDocx(file) {
  if (!file) throw new DocxError("No file chosen.");

  const looksRight =
    file.type === DOCX_TYPE || /\.docx$/i.test(file.name || "");
  if (!looksRight) {
    throw new DocxError(
      "That is not a .docx. A PDF has no paragraphs to read — open it and " +
        "paste the text instead."
    );
  }
  if (file.size > MAX_BYTES) {
    throw new DocxError(
      `That file is ${Math.round(file.size / 1024)} KB. A cover letter should ` +
        "be a few tens of KB — this one is probably full of images."
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  // A .docx is a ZIP, so it starts "PK". Checking here rather than
  // letting the converter discover it gives a message worth reading — and
  // keeps the library off the path entirely for input that cannot work.
  const magic = new Uint8Array(arrayBuffer.slice(0, 4));
  if (magic[0] !== 0x50 || magic[1] !== 0x4b) {
    throw new DocxError(
      "That file is not a readable .docx — it may be corrupt, or renamed from " +
        "something else."
    );
  }

  const mammoth = await import("mammoth");
  // Handled on the promise rather than around an await. mammoth is built on
  // bluebird, which reports a rejection as unhandled if nothing is attached to
  // the promise it produced, even when an enclosing try/catch would have
  // caught it — and vitest fails the whole run on an unhandled rejection.
  const html = await mammoth
    .convertToHtml({ arrayBuffer })
    .then((result) => result.value)
    .catch((err) => {
      throw new DocxError(`Could not read that .docx: ${err.message}`);
    });

  // Sanitising is what drops any embedded images, since IMG is not in the
  // allowlist. mammoth would otherwise inline them as base64 data URIs and
  // they would land in the column, and then in every backup.
  const clean = sanitiseHtml(html);
  if (!clean.replace(/<[^>]*>/g, "").trim()) {
    throw new DocxError("That .docx has no text in it.");
  }
  return clean;
}
