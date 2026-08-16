import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listApplications } from "../api/client.js";
import ApplicationList from "../components/ApplicationList.jsx";
import Filters from "../components/Filters.jsx";

const PAGE_SIZE = 50;

const DEFAULTS = {
  search: "",
  status: "",
  show: "active",
  sort_by: "date_applied",
  sort_dir: "desc",
};

export default function ListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search/filter/sort live in the URL rather than component state, so the view
  // survives a reload and can be linked to. See REQUIREMENTS.md §4.2.
  const search = searchParams.get("search") ?? DEFAULTS.search;
  const status = searchParams.get("status") ?? DEFAULTS.status;
  const show = searchParams.get("show") ?? DEFAULTS.show;
  const sortBy = searchParams.get("sort_by") ?? DEFAULTS.sort_by;
  const sortDir = searchParams.get("sort_dir") ?? DEFAULTS.sort_dir;

  /**
   * Writes params, omitting anything at its default so the URL stays readable.
   * `replace` avoids one history entry per keystroke while typing a search;
   * discrete actions (filter, sort) push, so Back undoes them.
   */
  const setParams = useCallback(
    (changes, { replace = false } = {}) => {
      const next = {
        search,
        status,
        show,
        sort_by: sortBy,
        sort_dir: sortDir,
        ...changes,
      };
      const params = {};
      for (const [key, value] of Object.entries(next)) {
        if (value !== DEFAULTS[key] && value !== "") params[key] = value;
      }
      setSearchParams(params, { replace });
    },
    [search, status, show, sortBy, sortDir, setSearchParams]
  );

  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(
    async ({ skip, limit, append }) => {
      const data = await listApplications({
        search,
        status,
        show,
        sort_by: sortBy,
        sort_dir: sortDir,
        skip,
        limit,
      });
      setApplications((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
    },
    [search, status, show, sortBy, sortDir]
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

  const remaining = total - applications.length;

  return (
    <>
      <header>
        <h1>Job Application Tracker</h1>
        <button onClick={() => navigate("/applications/new")}>
          + Add application
        </button>
      </header>

      <Filters
        search={search}
        onSearchChange={(value) => setParams({ search: value }, { replace: true })}
        status={status}
        onStatusChange={(value) => setParams({ status: value })}
        show={show}
        onShowChange={(value) => setParams({ show: value })}
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
            onOpen={(app) => navigate(`/applications/${app.id}`)}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(col, dir) => setParams({ sort_by: col, sort_dir: dir })}
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
    </>
  );
}
