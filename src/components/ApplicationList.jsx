import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";
import { isOpenableLink } from "../jobLink.js";
import {
  EMPLOYMENT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from "../labels.js";

/**
 * Thousands, with a K — 106400 becomes "106K", rounded to nearest.
 *
 * Below 1000 the value is left alone. An hourly rate entered as 55 would
 * otherwise render as "0K", which is not merely ugly but wrong.
 */
function formatAmount(value) {
  const n = Number(value);
  return n < 1000 ? n.toLocaleString() : `${Math.round(n / 1000).toLocaleString()}K`;
}

/**
 * List display only — the detail screen keeps raw numbers in its editable
 * fields, and the stored decimal(10,2) is untouched either way.
 *
 * Three rules, each decided rather than incidental:
 *
 *   - **An hourly rate is never scaled to thousands** and carries "/hr"
 *     (KAN-50). Before pay_period existed, magnitude was the only thing
 *     telling the two apart, and 86 rendered as a bare "86-86" that said
 *     nothing about being a rate.
 *   - **A single figure is shown once**, not as "120K-120K". True of an
 *     hourly 86-86 and of the annual row that carries the same number twice.
 *   - **The currency is omitted for USD** (§4.2), which every job in this
 *     search pays in, so the suffix would be noise on every row. Anything
 *     else still labels itself rather than showing a misleading bare number.
 */
function formatSalary(app) {
  if (!app.salary_min && !app.salary_max) return "—";

  const hourly = app.pay_period === "hourly";
  // An hourly rate is never in the thousands, so the K-notation would be
  // wrong rather than merely unhelpful.
  const one = (v) => (hourly ? Number(v).toLocaleString() : formatAmount(v));

  const { salary_min: lo, salary_max: hi } = app;
  const amount =
    lo && hi && Number(lo) !== Number(hi)
      ? `${one(lo)}–${one(hi)}`
      : one(lo || hi);

  const rate = hourly ? "/hr" : "";
  const currency =
    app.salary_currency && app.salary_currency !== "USD"
      ? ` ${app.salary_currency}`
      : "";

  return `${amount}${rate}${currency}`;
}

/**
 * Required experience, which is stored as a *minimum* (§2).
 *
 * "3-5 years" and "5+" both store as their lower bound, so "at least n" is
 * true of either and a bare number would read as an exact requirement. Zero
 * is a real answer distinct from blank — an entry-level posting states no
 * minimum — and "0+" says nothing, so it gets a word.
 */
function formatExperience(years) {
  if (years === null || years === undefined || years === "") return "—";
  const n = Number(years);
  if (!Number.isFinite(n)) return "—";
  return n === 0 ? "Entry" : `${n}+`;
}

export default function ApplicationList({
  applications,
  sortBy,
  sortDir,
  onSortChange,
  onStatusChange,
}) {
  function headerClick(col) {
    if (sortBy === col) {
      onSortChange(col, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col, "asc");
    }
  }

  function arrow(col) {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  if (applications.length === 0) {
    return <p className="empty-state">No applications yet. Add your first one above.</p>;
  }

  return (
    <table className="app-table">
      <thead>
        <tr>
          <th onClick={() => headerClick("company")}>Company{arrow("company")}</th>
          <th className="col-wide col-link">Link</th>
          <th className="col-wide" onClick={() => headerClick("role_title")}>
            Role{arrow("role_title")}
          </th>
          {/* Location was dropped here (KAN-51) to make room: the search is
              effectively all-remote, so the column said "Remote" on nearly
              every row. It is still stored, still searchable, and still on
              the detail screen. */}
          <th className="col-wide" onClick={() => headerClick("employment_type")}>
            Type{arrow("employment_type")}
          </th>
          <th className="col-wide" onClick={() => headerClick("source")}>
            Source{arrow("source")}
          </th>
          <th
            className="col-wide"
            onClick={() => headerClick("years_experience_min")}
          >
            Experience{arrow("years_experience_min")}
          </th>
          <th onClick={() => headerClick("status")}>Status{arrow("status")}</th>
          {/* "Pay" rather than "Salary": the column now holds an annual
              figure or an hourly rate (KAN-50). The database columns keep
              their salary_* names — see the story for why. */}
          <th className="col-wide">Pay</th>
          <th onClick={() => headerClick("next_action_date")}>
            Next action{arrow("next_action_date")}
          </th>
          <th onClick={() => headerClick("date_applied")}>
            Applied{arrow("date_applied")}
          </th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          // The hover highlight stays although the row is no longer
          // clickable. At ten columns it is what lets the eye track across a
          // row, which is a reading aid independent of clicking — and the
          // links below carry the affordance, so nothing relies on it to look
          // actionable.
          <tr key={app.id} className="row-hover">
            <td>
              <Link className="record-link" to={`/applications/${app.id}`}>
                {app.company}
              </Link>
            </td>
            <td className="col-wide col-link">
              {isOpenableLink(app.job_link) ? (
                <a
                  href={app.job_link}
                  target="_blank"
                  // noopener: without it the opened page gets a handle on
                  // window.opener and can navigate this tab elsewhere.
                  rel="noopener noreferrer"
                  className="link-out"
                  // The glyph is identical on every row, so the company is
                  // what makes one link distinguishable from another.
                  aria-label={`Open the posting for ${app.company} in a new tab`}
                >
                  ↗
                </a>
              ) : (
                "—"
              )}
            </td>
            {/* The second way in, and the one KAN-60 was asked for. Company
                carries it too because this column does not exist below 900px
                — Role alone would leave a phone with no way to open a
                record. */}
            <td className="col-wide">
              <Link className="record-link" to={`/applications/${app.id}`}>
                {app.role_title}
              </Link>
            </td>
            <td className="col-wide">
              {EMPLOYMENT_TYPE_LABELS[app.employment_type] || "—"}
            </td>
            <td className="col-wide">{app.source || "—"}</td>
            <td className="col-wide">
              {formatExperience(app.years_experience_min)}
            </td>
            {/* The only cell whose *content* is responsive rather than its
                presence. A dropdown here is a mis-tap hazard on touch, and
                unlike KAN-45's link a mis-tap changes data — so the phone
                keeps the badge and the desktop gets the control. See KAN-59. */}
            <td className="col-status">
              <span className="col-narrow">
                <StatusBadge status={app.status} />
              </span>
              <select
                className={`col-wide status-select badge-${app.status}`}
                aria-label={`Status for ${app.company}`}
                value={app.status}
                onChange={(e) => onStatusChange?.(app, e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </td>
            <td className="col-wide col-salary">{formatSalary(app)}</td>
            <td>
              {app.next_action ? (
                <>
                  {app.next_action}
                  {app.next_action_date && (
                    <span className="cell-sub">{app.next_action_date}</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </td>
            <td className="col-date">{app.date_applied || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
