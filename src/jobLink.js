/**
 * Whether a stored job_link is safe to render as a live anchor (KAN-45).
 *
 * The API validates job_link as http(s) on save, but this also runs against
 * *unsaved* form state on the detail screen, where the value is whatever has
 * been typed or pasted so far. Anything that is not http(s) renders no link
 * rather than a broken or dangerous one.
 *
 * Parsed with the URL constructor rather than matched with /^https?:/ because
 * the parser strips ASCII tab and newline before reading the scheme — so
 * "java\nscript:alert(1)" is seen for what it is, which a regex on the raw
 * string is not.
 */
export function isOpenableLink(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    // Not an absolute URL at all — a relative path, or half-typed.
    return false;
  }
}
