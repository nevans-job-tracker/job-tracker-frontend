import { STATUS_OPTIONS } from "./StatusBadge.jsx";

// Archive state is independent of status: both filters apply at once.
const SHOW_OPTIONS = [
  ["active", "Active"],
  ["archived", "Archived"],
  ["all", "All"],
];

export default function Filters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  show,
  onShowChange,
}) {
  return (
    <div className="filters">
      <input
        className="search-input"
        placeholder="Search company, role, location, source, notes..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      <select
        aria-label="Show archived"
        value={show}
        onChange={(e) => onShowChange(e.target.value)}
      >
        {SHOW_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
