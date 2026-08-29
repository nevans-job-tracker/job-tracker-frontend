import { STATUS_OPTIONS, STATUS_LABELS } from "../labels.js";

// Archive state is independent of status: both filters apply at once.
const SHOW_OPTIONS = [
  ["active", "Active"],
  ["archived", "Archived"],
  ["all", "All"],
];

export default function Filters({
  search,
  onSearchChange,
  sources = [],
  source,
  onSourceChange,
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
          placeholder="Search company, role, location, notes..."
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
      {/* Options come from the data rather than a fixed list, so a source the
          extension does not produce — a manual "Referral", or a typo — is
          still offered and still filterable. See KAN-56. */}
      <select
        aria-label="Filter by source"
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
      >
        <option value="">All Sources</option>
        {sources.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
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
