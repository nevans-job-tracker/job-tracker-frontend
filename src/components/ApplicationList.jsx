import StatusBadge from "./StatusBadge.jsx";

function formatSalary(app) {
  if (!app.salary_min && !app.salary_max) return "—";
  const currency = app.salary_currency || "";
  if (app.salary_min && app.salary_max) {
    return `${Number(app.salary_min).toLocaleString()}–${Number(
      app.salary_max
    ).toLocaleString()} ${currency}`;
  }
  const val = app.salary_min || app.salary_max;
  return `${Number(val).toLocaleString()} ${currency}`;
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
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(app);
              }
            }}
          >
            <td>{app.company}</td>
            <td className="col-wide">{app.role_title}</td>
            <td className="col-wide">{app.location || "—"}</td>
            <td className="col-wide">{app.source || "—"}</td>
            <td>
              <StatusBadge status={app.status} />
            </td>
            <td className="col-wide">{formatSalary(app)}</td>
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
            <td>{app.date_applied}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
