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
  onEdit,
  onDelete,
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
          <th onClick={() => headerClick("role_title")}>Role{arrow("role_title")}</th>
          <th>Location</th>
          <th onClick={() => headerClick("status")}>Status{arrow("status")}</th>
          <th>Salary</th>
          <th onClick={() => headerClick("date_applied")}>Applied{arrow("date_applied")}</th>
          <th>Link</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          <tr key={app.id}>
            <td>{app.company}</td>
            <td>{app.role_title}</td>
            <td>{app.location || "—"}</td>
            <td>
              <StatusBadge status={app.status} />
            </td>
            <td>{formatSalary(app)}</td>
            <td>{app.date_applied}</td>
            <td>
              {app.job_link ? (
                <a href={app.job_link} target="_blank" rel="noreferrer">
                  Posting
                </a>
              ) : (
                "—"
              )}
            </td>
            <td className="row-actions">
              <button onClick={() => onEdit(app)}>Edit</button>
              <button className="danger" onClick={() => onDelete(app)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
