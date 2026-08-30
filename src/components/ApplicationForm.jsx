import { useEffect, useMemo, useRef, useState } from "react";
import {
  STATUS_OPTIONS,
  STATUS_LABELS,
  COMPANY_SIZE_OPTIONS,
  COMPANY_SIZE_LABELS,
  PAY_PERIOD_OPTIONS,
  PAY_PERIOD_LABELS,
  EMPLOYMENT_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_LABELS,
  CONTRACT_TYPES,
} from "../labels.js";
import { isOpenableLink } from "../jobLink.js";
import CoverLetterField from "./CoverLetterField.jsx";

const emptyForm = {
  company: "",
  role_title: "",
  job_link: "",
  source: "",
  location: "",
  company_size: "",
  years_experience_min: "",
  status: "applied",
  salary_min: "",
  salary_max: "",
  pay_period: "annual",
  employment_type: "",
  contract_term_months: "",
  hours_per_week_min: "",
  hours_per_week_max: "",
  date_applied: new Date().toISOString().slice(0, 10),
  next_action: "",
  next_action_date: "",
  notes: "",
  job_description: "",
  cover_letter: "",
};

// Only these are sent to the API. Picking explicitly keeps server-managed
// fields (id, created_at, contacts, ...) out of the payload.
//
// `salary_currency` is deliberately absent. It was a free-text input, which is
// how "A$" ended up on a Remote (United States) role — a typo the list then
// faithfully rendered. Every job in this search pays in USD (§4.2), so the
// field was an opportunity to get it wrong and nothing else. Omitting it means
// a create takes the API's USD default and an edit leaves the stored value
// untouched.
function toForm(initial) {
  if (!initial) return emptyForm;
  // Today's date is a default for a *new* record only. A saved application
  // with no date applied is a real state now (§2), so it must render with the
  // field empty — falling back to emptyForm here would pre-fill today and
  // silently stamp it on the next save.
  const form = { ...emptyForm, date_applied: "" };
  for (const key of Object.keys(emptyForm)) {
    if (initial[key] !== null && initial[key] !== undefined) {
      form[key] = initial[key];
    }
  }
  return form;
}

const today = () => new Date().toISOString().slice(0, 10);

// The only fields where what the user typed and what the server stores can
// differ as strings while meaning the same thing: "120000" comes back
// "120000.00". Comparing those literally would leave the form permanently
// dirty after every save.
const NUMERIC_FIELDS = [
  "salary_min",
  "salary_max",
  "years_experience_min",
  "contract_term_months",
  "hours_per_week_min",
  "hours_per_week_max",
];

const sameValue = (key, a, b) =>
  NUMERIC_FIELDS.includes(key)
    ? (a === "" ? null : Number(a)) === (b === "" ? null : Number(b))
    : a === b;

export default function ApplicationForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  closeLabel,
  onDirtyChange,
}) {
  const [form, setForm] = useState(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusChosen, setStatusChosen] = useState(false);

  // Which of the two submit buttons was pressed. Both are type="submit" on the
  // same form, so the intent has to be captured on click and read back here.
  // A ref rather than state: it is read once during the submit that follows
  // immediately, and setting state would re-render the form for nothing.
  const closeAfterSave = useRef(false);

  // On a new record the status follows the date until the user picks one:
  // clearing the date shows Interested, typing one back shows Applied.
  //
  // This mirrors the API's own rule — a create with no date and no stated
  // status is stored as `interested` — rather than duplicating it. The form
  // always sends a status, so without this the select would read "Applied"
  // while an undated record is anything but. An existing record is left alone;
  // its status is whatever was saved.
  const isNew = !initial;
  const status =
    isNew && !statusChosen && !form.date_applied ? "interested" : form.status;

  // A future date is usually a typo — a mistyped year sorts to the top of the
  // list and stays there. It is still legitimate when logging something about
  // to be submitted, so this warns rather than blocking. See REQUIREMENTS.md §2.
  const dateIsInFuture = Boolean(form.date_applied) && form.date_applied > today();

  // The term field only appears for a contract. This mirrors the API rule
  // rather than replacing it — §6.1: a rule enforced only in the UI is
  // decorative while the API is directly reachable.
  const isContract = CONTRACT_TYPES.includes(form.employment_type);

  // Reported up so the page can warn before a navigation throws the edits
  // away. Saving replaces `initial`, which resets this without a remount.
  const pristine = useMemo(() => toForm(initial), [initial]);
  const dirty = useMemo(
    () => Object.keys(emptyForm).some((k) => !sameValue(k, form[k], pristine[k])),
    [form, pristine]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const blankToNull = (v) => (v === "" ? null : v);

  async function handleSubmit(e) {
    e.preventDefault();
    // Read and clear together. If this save fails and the user then presses
    // Save changes, a stale flag would navigate away from an error they have
    // not read yet.
    const close = closeAfterSave.current;
    closeAfterSave.current = false;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        status,
        date_applied: blankToNull(form.date_applied),
        company_size: blankToNull(form.company_size),
        years_experience_min:
          form.years_experience_min === "" ? null : Number(form.years_experience_min),
        salary_min: form.salary_min === "" ? null : Number(form.salary_min),
        salary_max: form.salary_max === "" ? null : Number(form.salary_max),
        employment_type: blankToNull(form.employment_type),
        // Cleared alongside the type, not merely hidden. The API rejects a
        // term on a non-contract role against the *merged* record, so leaving
        // a stale value here would make the next save fail with a message
        // about a field the form is no longer showing.
        contract_term_months:
          isContract && form.contract_term_months !== ""
            ? Number(form.contract_term_months)
            : null,
        hours_per_week_min:
          form.hours_per_week_min === "" ? null : Number(form.hours_per_week_min),
        hours_per_week_max:
          form.hours_per_week_max === "" ? null : Number(form.hours_per_week_max),
        job_link: blankToNull(form.job_link),
        source: blankToNull(form.source),
        location: blankToNull(form.location),
        next_action: blankToNull(form.next_action),
        next_action_date: blankToNull(form.next_action_date),
        notes: blankToNull(form.notes),
        job_description: blankToNull(form.job_description),
        cover_letter: blankToNull(form.cover_letter),
      };

      // The options argument is omitted rather than passed as false, so the
      // ordinary save keeps a one-argument contract and only the closing
      // variant has anything to say.
      await (close ? onSubmit(payload, { close: true }) : onSubmit(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="app-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <label>
          Company *
          <input
            required
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </label>
        <label>
          Role title *
          <input
            required
            value={form.role_title}
            onChange={(e) => update("role_title", e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        {/* The anchor is a sibling of the label, not a child of it. Nested
            inside, it would join the input's accessible name ("Job link Open
            posting") and clicking it would also focus the input. */}
        <div className="form-field">
          <label>
            Job link
            <input
              type="url"
              placeholder="https://..."
              value={form.job_link}
              onChange={(e) => update("job_link", e.target.value)}
            />
          </label>
          {isOpenableLink(form.job_link) && (
            <a
              href={form.job_link.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="field-action"
            >
              Open posting ↗
            </a>
          )}
        </div>
        <label>
          Source
          <input
            placeholder="LinkedIn, referral, company site..."
            value={form.source}
            onChange={(e) => update("source", e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Location
          <input
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatusChosen(true);
              update("status", e.target.value);
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Company size
          <select
            value={form.company_size}
            onChange={(e) => update("company_size", e.target.value)}
          >
            {/* Blank is a real answer, not a prompt: a posting often does not
                say, and guessing is worse than leaving it out. */}
            <option value="">Not stated</option>
            {COMPANY_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {COMPANY_SIZE_LABELS[size]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Years experience required
          <input
            type="number"
            min="0"
            placeholder="Minimum, e.g. 5 for &quot;5+ years&quot;"
            value={form.years_experience_min}
            onChange={(e) => update("years_experience_min", e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Salary min
          <input
            type="number"
            value={form.salary_min}
            onChange={(e) => update("salary_min", e.target.value)}
          />
        </label>
        <label>
          Salary max
          <input
            type="number"
            value={form.salary_max}
            onChange={(e) => update("salary_max", e.target.value)}
          />
        </label>
        <label>
          Pay period
          <select
            value={form.pay_period}
            onChange={(e) => update("pay_period", e.target.value)}
          >
            {PAY_PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PAY_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Employment type
          <select
            value={form.employment_type}
            onChange={(e) => update("employment_type", e.target.value)}
          >
            <option value="">Not recorded</option>
            {EMPLOYMENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {isContract && (
          <label>
            Contract term (months)
            <input
              type="number"
              min="0"
              value={form.contract_term_months}
              onChange={(e) => update("contract_term_months", e.target.value)}
            />
          </label>
        )}
      </div>

      {/* A pair, because postings state it as a range — "Commitment: 10-40
          hrs/week". Not gated on employment type: 20 hours a week means the
          same on a part-time role as on a contract. */}
      <div className="form-row">
        <label>
          Hours per week (min)
          <input
            type="number"
            min="0"
            value={form.hours_per_week_min}
            onChange={(e) => update("hours_per_week_min", e.target.value)}
          />
        </label>
        <label>
          Hours per week (max)
          <input
            type="number"
            min="0"
            value={form.hours_per_week_max}
            onChange={(e) => update("hours_per_week_max", e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Date applied
          <input
            type="date"
            value={form.date_applied}
            onChange={(e) => update("date_applied", e.target.value)}
            aria-describedby={dateIsInFuture ? "date-applied-warning" : undefined}
          />
          {dateIsInFuture && (
            <span className="form-warning" id="date-applied-warning">
              That date is in the future — check the year if it was a typo. You
              can still save it.
            </span>
          )}
        </label>
        <label>
          Next action
          <input
            placeholder="Follow up with recruiter"
            value={form.next_action}
            onChange={(e) => update("next_action", e.target.value)}
          />
        </label>
        <label>
          Next action date
          <input
            type="date"
            value={form.next_action_date}
            onChange={(e) => update("next_action_date", e.target.value)}
          />
        </label>
      </div>

      <label className="form-notes">
        Notes
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
        />
      </label>

      <label className="form-notes">
        Job description
        <textarea
          rows={6}
          placeholder="Paste the posting here — it outlives the link once the ad comes down."
          value={form.job_description}
          onChange={(e) => update("job_description", e.target.value)}
        />
      </label>

      <CoverLetterField
        value={form.cover_letter}
        company={form.company}
        onChange={(next) => update("cover_letter", next)}
      />

      {/* A hierarchy rather than three colours: quietest, secondary, primary.
          Save and close takes the filled slot because it is the common path —
          saving is usually followed by going back to the list — not because
          of which control existed first. See KAN-58. */}
      <div className="form-actions">
        <button
          type="button"
          className="button-quiet"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="button-secondary" disabled={saving}>
          {saving ? "Saving..." : submitLabel || "Save"}
        </button>
        <button
          type="submit"
          disabled={saving}
          onClick={() => {
            closeAfterSave.current = true;
          }}
        >
          {closeLabel || "Save and close"}
        </button>
      </div>
    </form>
  );
}
