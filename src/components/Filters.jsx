import {
  STATUS_LABELS,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  STATUS_SET_OPTIONS,
  STATUS_SET_PREFIX,
} from "../labels.js";

// Archive state is independent of status: both filters apply at once.
//
// The labels say what you are looking at rather than what to do about it
// (KAN-62). An imperative — "Hide Archived" — sitting in a closed select reads
// as a button: it implies the hiding has not happened and invites a click to
// make it so. A select's closed state describes the current view.
//
// "Archived" leads all three so they align in a column and the varying word is
// where the eye lands. It also keeps Only and Included mutually exclusive,
// where "Archived Displayed" and "All Displayed" were both true of a view
// containing archived rows.
//
// The wire values are untouched; only these labels changed. `show=active` and
// `activity=active` still mean unrelated things on the API, which is recorded
// as a decision in the route rather than fixed by a rename.
const SHOW_OPTIONS = [
  ["active", "Archived Hidden"],
  ["archived", "Archived Only"],
  ["all", "Archived Included"],
];

export default function Filters({
  search,
  onSearchChange,
  sources = [],
  source,
  onSourceChange,
  status,
  activity,
  onStatusFilterChange,
  show,
  onShowChange,
}) {
  // One control, two parameters. A specific status wins outright and the set
  // options carry the lifecycle, so the dropdown never shows a value that is
  // only half of what is being filtered on.
  const statusValue = status ? status : `${STATUS_SET_PREFIX}${activity}`;
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
      {/* The sets sit above the individual statuses, and the groups below
          spell out what each set contains — "Active Statuses" is a guess
          otherwise. Grouped with optgroup rather than coloured: grouping is
          structural and always renders, where option background colours are
          honoured in Chrome and not dependably anywhere else. */}
      <select
        aria-label="Filter by status"
        value={statusValue}
        onChange={(e) => onStatusFilterChange(e.target.value)}
      >
        {STATUS_SET_OPTIONS.map(([value, label]) => (
          <option key={value} value={`${STATUS_SET_PREFIX}${value}`}>
            {label}
          </option>
        ))}
        <optgroup label="Active">
          {ACTIVE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Inactive">
          {INACTIVE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </optgroup>
      </select>
      <select
        aria-label="Filter by archive state"
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
