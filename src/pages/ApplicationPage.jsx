import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import {
  getApplication,
  createApplication,
  updateApplication,
  archiveApplication,
  unarchiveApplication,
} from "../api/client.js";
import ApplicationForm from "../components/ApplicationForm.jsx";
import ContactsEditor from "../components/ContactsEditor.jsx";

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

  function goBack(e) {
    if (!cameFromApp) return;
    e.preventDefault();
    navigate(-1);
  }

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      setApplication(await getApplication(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(data) {
    if (isNew) {
      const created = await createApplication(data);
      // Populate before navigating: the route changes on this same mounted
      // component, so isNew flips to false immediately and the render would
      // otherwise dereference a null application.
      setApplication(created);
      navigate(`/applications/${created.id}`, { replace: true });
      return;
    }
    setApplication(await updateApplication(id, data));
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
        {saved && <span className="saved-flag">Saved</span>}
      </header>

      {error && <div className="form-error">{error}</div>}

      <ApplicationForm
        key={application?.id ?? "new"}
        initial={application}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/")}
        submitLabel={isNew ? "Create application" : "Save changes"}
      />

      {isNew ? (
        <p className="empty-state">
          Contacts can be added once the application has been created.
        </p>
      ) : (
        <>
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
