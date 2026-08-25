import StatusBadge from "./StatusBadge.jsx";
import { isOpenableLink } from "../jobLink.js";

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
 * The currency is omitted for USD, which every job in this search pays in, so
 * the suffix would be noise on every row of a column that only survives on
 * wider screens (§4.2). Anything else still labels itself rather than showing
 * a misleading bare number.
 */
function formatSalary(app) {
  if (!app.salary_min && !app.salary_max) return "—";

  const suffix =
    app.salary_currency && app.salary_currency !== "USD"
      ? ` ${app.salary_currency}`
      : "";

  const amount =
    app.salary_min && app.salary_max
      ? `${formatAmount(app.salary_min)}–${formatAmount(app.salary_max)}`
      : formatAmount(app.salary_min || app.salary_max);

  return `${amount}${suffix}`;
}

export default function ApplicationList({
  applications,
  onOpen,
  sortBy,
  sortDir,
  onSortChange,
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
          <th className="col-wide" onClick={() => headerClick("location")}>
            Location{arrow("location")}
          </th>
          <th className="col-wide" onClick={() => headerClick("source")}>
            Source{arrow("source")}
          </th>
          <th onClick={() => headerClick("status")}>Status{arrow("status")}</th>
          <th className="col-wide">Salary</th>
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
          <tr
            key={app.id}
            className="row-clickable"
            tabIndex={0}
            onClick={() => onOpen(app)}
            onKeyDown={(e) => {
              // Only when the row itself has focus. The link inside it is
              // separately focusable, and this handler calls preventDefault —
              // so without this guard, Enter on the link would suppress the
              // anchor's own activation and navigate to the detail screen
              // instead of opening the posting.
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(app);
              }
            }}
          >
            <td>{app.company}</td>
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
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </a>
              ) : (
                "—"
              )}
            </td>
            <td className="col-wide">{app.role_title}</td>
            <td className="col-wide">{app.location || "—"}</td>
            <td className="col-wide">{app.source || "—"}</td>
            <td>
              <StatusBadge status={app.status} />
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
