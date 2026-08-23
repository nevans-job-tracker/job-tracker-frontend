import { useRef, useState } from "react";
import { toDisplayHtml, htmlToText, downloadCoverLetter } from "../coverLetter.js";
import { convertDocx, DocxError } from "../docx.js";

/**
 * The cover letter, which is the one field that is not simply a box.
 *
 * The stored value may be prose (typed, pasted, or written before KAN-41) or
 * HTML converted from a .docx. `toDisplayHtml` reconciles the two, so this
 * component never has to know which it is holding.
 *
 * Two states rather than a permanent textarea: editing HTML by hand is not a
 * thing anyone should do, and a preview of a letter is more useful than its
 * markup. Empty starts in edit mode, because there is nothing to preview and
 * the paste path is the fallback for a letter that only exists as a PDF.
 */
export default function CoverLetterField({ value, company, onChange }) {
  const [editing, setEditing] = useState(!value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);

  const has = Boolean(String(value || "").trim());

  async function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    // Reset immediately so choosing the same file twice still fires a change.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      onChange(await convertDocx(file));
      setEditing(false);
    } catch (err) {
      setError(err instanceof DocxError ? err.message : String(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cover-letter">
      <span className="cover-letter-label" id="cover-letter-label">
        Cover letter
      </span>

      {error && <div className="form-error">{error}</div>}

      {editing ? (
        <textarea
          rows={8}
          aria-labelledby="cover-letter-label"
          placeholder="Type or paste the letter. Upload a .docx to keep its formatting."
          // Prose in, prose out: switching to editing hands back the text of
          // whatever was stored, so this never shows raw markup.
          value={htmlToText(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        // Safe because everything reaching here has been through the allowlist
        // in coverLetter.js, on the way in from a .docx and again on the way
        // out. See the note on ALLOWED for why IMG is absent.
        <div
          className="cover-letter-preview"
          aria-labelledby="cover-letter-label"
          dangerouslySetInnerHTML={{ __html: toDisplayHtml(value) }}
        />
      )}

      <div className="cover-letter-actions">
        {/* .docx only: a PDF has no structure to read, so it would convert
            worse than the source document you already have. */}
        <input
          type="file"
          accept=".docx"
          ref={fileInput}
          onChange={handleFile}
          hidden
          data-testid="cover-letter-file"
        />
        <button
          type="button"
          className="link-button"
          disabled={busy}
          onClick={() => fileInput.current.click()}
        >
          {busy ? "Converting..." : has ? "Replace with .docx" : "Upload .docx"}
        </button>

        {has && (
          <button
            type="button"
            className="link-button"
            onClick={() => setEditing((was) => !was)}
          >
            {editing ? "Done editing" : "Edit as text"}
          </button>
        )}

        {/* Exports what is on screen rather than what was last saved, so an
            edit can be pulled out without saving first. */}
        <button
          type="button"
          className="link-button"
          disabled={!has}
          onClick={() => downloadCoverLetter(value, company)}
        >
          Download as HTML
        </button>
      </div>
    </div>
  );
}
