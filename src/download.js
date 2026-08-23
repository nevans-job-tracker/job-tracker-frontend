/**
 * Hands the browser a file to save.
 *
 * Extracted from the CSV export (KAN-39) when the cover letter needed the same
 * dance (KAN-40). The anchor has to be in the document for the click to count,
 * and both it and the object URL have to be released afterwards or every
 * export leaks one of each.
 */
export function downloadFile(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Turns a company name into something safe to put in a filename. */
export function slug(value, fallback = "application") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}
