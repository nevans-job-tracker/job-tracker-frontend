import { STATUS_OPTIONS, STATUS_LABELS } from "./StatusBadge.jsx";

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
      {/* The button is a sibling of the input inside a positioned wrapper,
          not inside it — an input cannot contain elements. It renders only
          when there is something to clear, so it never sits there inert. */}
      <div className="search-field">
        <input
          className="search-input"
          placeholder="Search company, role, location, source, notes..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
          >
            &times;
          </button>
        )}
      </div>
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
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
