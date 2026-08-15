import { useEffect, useState, useCallback } from "react";
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "./api/client.js";
import ApplicationList from "./components/ApplicationList.jsx";
import ApplicationForm from "./components/ApplicationForm.jsx";
import Filters from "./components/Filters.jsx";

const PAGE_SIZE = 50;

export default function App() {
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("date_applied");
  const [sortDir, setSortDir] = useState("desc");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchPage = useCallback(
    async ({ skip, limit, append }) => {
      const data = await listApplications({
        search,
        status,
        sort_by: sortBy,
        sort_dir: sortDir,
        skip,
        limit,
      });
      setApplications((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
    },
    [search, status, sortBy, sortDir]
  );

  // Search/filter/sort changes reset back to the first page.
  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchPage({ skip: 0, limit: PAGE_SIZE, append: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    const timeout = setTimeout(loadFirstPage, 250); // debounce search typing
    return () => clearTimeout(timeout);
  }, [loadFirstPage]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({
        skip: applications.length,
        limit: PAGE_SIZE,
        append: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Re-fetch after a mutation, keeping however many pages are already loaded
  // so the user isn't thrown back to the top of the list.
  async function reloadLoaded() {
    setError(null);
    try {
      await fetchPage({
        skip: 0,
        limit: Math.max(PAGE_SIZE, applications.length),
        append: false,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(data) {
    await createApplication(data);
    setShowForm(false);
    reloadLoaded();
  }

  async function handleUpdate(data) {
    await updateApplication(editing.id, data);
    setEditing(null);
    reloadLoaded();
  }

  async function handleDelete(app) {
    if (!confirm(`Delete application to ${app.company}?`)) return;
    await deleteApplication(app.id);
    reloadLoaded();
  }

  function handleSortChange(col, dir) {
    setSortBy(col);
    setSortDir(dir);
  }

  const remaining = total - applications.length;

  return (
    <div className="container">
      <header>
        <h1>Job Application Tracker</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ Add application"}
        </button>
      </header>

      {showForm && (
        <ApplicationForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {editing && (
        <ApplicationForm
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      )}

      <Filters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
      />

      <p className="result-count">
        {remaining > 0
          ? `Showing ${applications.length} of ${total} applications`
          : `${total} application${total === 1 ? "" : "s"}`}
      </p>

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <ApplicationList
            applications={applications}
            onEdit={setEditing}
            onDelete={handleDelete}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleSortChange}
          />

          {remaining > 0 && (
            <div className="load-more">
              <button onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : `Load more (${remaining} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
