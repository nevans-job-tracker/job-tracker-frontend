import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import {
  getApplication,
  getStatusHistory,
  createApplication,
  updateApplication,
  archiveApplication,
  unarchiveApplication,
} from "../api/client.js";
import ApplicationForm from "../components/ApplicationForm.jsx";
import ContactsEditor from "../components/ContactsEditor.jsx";
import StatusTimeline from "../components/StatusTimeline.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

/**
 * Serves both the detail screen and the new-entry screen. With no :id it is a
 * blank form; with an :id it is the same form populated and saveable, rather
 * than a read view with a separate edit mode.
 */
export default function ApplicationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = id === undefined;

  // Arrived from within the app, so going back returns to the list with its
  // search/filter/sort intact. A cold load (bookmark, refresh) has no history
  // to return to, so the link falls through to a plain "/".
  const cameFromApp = location.key !== "default";

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState([]);

  /**
   * The detail screen *is* the edit form (§4.4), so leaving it discards
   * unsaved edits with no trace and retyping them is the only recovery.
   *
   * That is the irreversible case §4.1 says a confirmation is actually for —
   * unlike archive, which is one click to undo and therefore prompts for
   * nothing. It only interrupts when something would genuinely be lost.
   */
  function confirmLeave() {
    return (
      !dirty ||
      window.confirm(
        "You have unsaved changes to this application. Leave without saving?"
      )
    );
  }

  function goBack(e) {
    if (!confirmLeave()) {
      e.preventDefault();
      return;
    }
    if (!cameFromApp) return;
    e.preventDefault();
    navigate(-1);
  }

  // Entering several in a row otherwise means a trip back to the list between
  // each one, since saving lands on the new record's detail screen (KAN-33).
  function startAnother() {
    if (!confirmLeave()) return;
    navigate("/applications/new");
  }

  const load = useCallback(async () => {
    if (isNew) {
      // Both routes render this same component, so React reuses the instance
      // rather than remounting when you go from a record to /applications/new.
      // Without clearing it, the previous record stays in state, the form key
      // stays that record's id, and the "new" screen comes up showing its
      // values — one Create away from a duplicate.
      setApplication(null);
      setError(null);
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      // Two requests rather than one embedded response: history is deliberately
      // not on ApplicationOut, because that schema is what the CSV export reads
      // and it would lazily load history per row. See StatusChangeOut.
      const [record, changes] = await Promise.all([
        getApplication(id),
        getStatusHistory(id),
      ]);
      setApplication(record);
      setHistory(changes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * `close` comes from which submit button was pressed (KAN-58).
   *
   * The unsaved-changes guard is deliberately not consulted. It exists for
   * navigations that *discard* typing (§4.4); this one saves first, so
   * prompting would ask whether to throw away work that is already stored.
   * Navigating programmatically rather than through the guarded Link is what
   * keeps that true.
   */
  async function handleSubmit(data, { close = false } = {}) {
    if (isNew) {
      const created = await createApplication(data);
      if (close) {
        navigate("/");
        return;
      }
      // Populate before navigating: the route changes on this same mounted
      // component, so isNew flips to false immediately and the render would
      // otherwise dereference a null application.
      setApplication(created);
      navigate(`/applications/${created.id}`, { replace: true });
      return;
    }

    setApplication(await updateApplication(id, data));
    if (close) {
      navigate("/");
      return;
    }
    // Only worth flashing when the user stays to see it.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // No confirmation prompt: archiving is reversible in one click, and
  // confirmations are for irreversible actions. See REQUIREMENTS.md §4.1.
  async function handleArchive() {
    try {
      await archiveApplication(id);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnarchive() {
    try {
      setApplication(await unarchiveApplication(id));
    } catch (err) {
      setError(err.message);
    }
  }

  // Guards the window between the route gaining an :id and the record arriving.
  if (loading || (!isNew && !application && !error)) return <p>Loading...</p>;

  if (error && !application) {
    return (
      <>
        <div className="form-error">{error}</div>
        <p>
          <Link to="/">Back to all applications</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <header>
        <div>
          <Link className="back-link" to="/" onClick={goBack}>
            ← All applications
          </Link>
          <h1>
            {isNew
              ? "New application"
              : `${application.company} — ${application.role_title}`}
          </h1>
          {/* Otherwise there is no way to tell why this record is missing
              from the default list view. */}
          {application?.archived_at && (
            <span className="badge badge-ghosted">Archived</span>
          )}
        </div>
        <div className="header-actions">
          {saved && <span className="saved-flag">Saved</span>}
          <ThemeToggle />
          {/* Deliberately absent on the new-entry screen: it would navigate to
              the route already showing, so it would either do nothing or
              silently wipe what has been typed. There is nothing to add to
              while you are already adding. */}
          {!isNew && (
            <button type="button" onClick={startAnother}>
              + Add application
            </button>
          )}
        </div>
      </header>

      {error && <div className="form-error">{error}</div>}

      <ApplicationForm
        key={application?.id ?? "new"}
        initial={application}
        onDirtyChange={setDirty}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/")}
        submitLabel={isNew ? "Create application" : "Save changes"}
        closeLabel={isNew ? "Create and close" : "Save and close"}
      />

      {isNew ? (
        <p className="empty-state">
          Contacts can be added once the application has been created.
        </p>
      ) : (
        <>
          {/* Between the form and the contacts: the form is the application,
              this is derived from it, contacts are related records. */}
          <StatusTimeline history={history} createdAt={application.created_at} />

          <ContactsEditor
            applicationId={application.id}
            contacts={application.contacts || []}
            onChanged={load}
          />

          <div className="danger-zone">
            {application.archived_at ? (
              <button onClick={handleUnarchive}>Unarchive application</button>
            ) : (
              <button className="danger" onClick={handleArchive}>
                Archive application
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
