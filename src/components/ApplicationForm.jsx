import { useState } from "react";
import { STATUS_OPTIONS, STATUS_LABELS } from "./StatusBadge.jsx";

const emptyForm = {
  company: "",
  role_title: "",
  job_link: "",
  source: "",
  location: "",
  status: "applied",
  salary_min: "",
  salary_max: "",
  salary_currency: "USD",
  date_applied: new Date().toISOString().slice(0, 10),
  next_action: "",
  next_action_date: "",
  notes: "",
  job_description: "",
};

// Only these are sent to the API. Picking explicitly keeps server-managed
// fields (id, created_at, contacts, ...) out of the payload.
function toForm(initial) {
  if (!initial) return emptyForm;
  const form = { ...emptyForm };
  for (const key of Object.keys(emptyForm)) {
    if (initial[key] !== null && initial[key] !== undefined) {
      form[key] = initial[key];
    }
  }
  return form;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ApplicationForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // A future date is usually a typo — a mistyped year sorts to the top of the
  // list and stays there. It is still legitimate when logging something about
  // to be submitted, so this warns rather than blocking. See REQUIREMENTS.md §2.
  const dateIsInFuture = Boolean(form.date_applied) && form.date_applied > today();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const blankToNull = (v) => (v === "" ? null : v);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        salary_min: form.salary_min === "" ? null : Number(form.salary_min),
        salary_max: form.salary_max === "" ? null : Number(form.salary_max),
        job_link: blankToNull(form.job_link),
        source: blankToNull(form.source),
        location: blankToNull(form.location),
        next_action: blankToNull(form.next_action),
        next_action_date: blankToNull(form.next_action_date),
        notes: blankToNull(form.notes),
        job_description: blankToNull(form.job_description),
      });
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
        <label>
          Job link
          <input
            type="url"
            placeholder="https://..."
            value={form.job_link}
            onChange={(e) => update("job_link", e.target.value)}
          />
        </label>
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
          <select value={form.status} onChange={(e) => update("status", e.target.value)}>
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
          Currency
          <input
            value={form.salary_currency}
            onChange={(e) => update("salary_currency", e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Date applied *
          <input
            required
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

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel || "Save"}
        </button>
      </div>
    </form>
  );
}
