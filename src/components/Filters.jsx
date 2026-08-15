import { STATUS_OPTIONS } from "./StatusBadge.jsx";

export default function Filters({ search, onSearchChange, status, onStatusChange }) {
  return (
    <div className="filters">
      <input
        className="search-input"
        placeholder="Search company, role, location..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select value={status} onChange={(e) => onStatusChange(e.target.value)}>
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
