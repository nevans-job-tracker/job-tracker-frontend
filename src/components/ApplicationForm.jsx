import { useState } from "react";
import { STATUS_OPTIONS } from "./StatusBadge.jsx";

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
  notes: "",
};

export default function ApplicationForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ? { ...emptyForm, ...initial } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        salary_min: form.salary_min === "" ? null : Number(form.salary_min),
        salary_max: form.salary_max === "" ? null : Number(form.salary_max),
        job_link: form.job_link || null,
        source: form.source || null,
        location: form.location || null,
        notes: form.notes || null,
      };
      await onSubmit(payload);
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
                {s.replace("_", " ")}
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

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
