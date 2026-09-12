import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStatusTimeline } from "../api/client.js";
import StatusChart from "../components/StatusChart.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

/**
 * The reporting screen (KAN-70) — one chart, on its own route.
 *
 * **Separate from the list, not a panel on it.** The list is a worklist: it
 * answers "what do I do next" and is read many times a day. This answers "how
 * is it going", which is a different question asked far less often, and putting
 * it above the table would push the work down the page every time.
 *
 * A real route rather than a toggle, for the reason §4.2 gives for keeping
 * filters in the URL: it can be linked and bookmarked, and Back leaves it.
 *
 * §7 listed reporting as a non-goal and has been amended — this is one screen
 * reading the history table, not a dashboard.
 */
export default function InsightsPage() {
  const [timeline, setTimeline] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getStatusTimeline();
        if (!cancelled) setTimeline(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* The way out sits top left with the title beneath it, and the header's
          right side is for controls. This screen had the link on the right, so
          it disagreed with the detail screen about where "back" lives — and a
          reader arrives here from the list, so this is the one that moved.

          `header-stacked` keeps the theme toggle level with the back link. The
          header centres its children by default, which is right when the left
          side is a single heading; with a link stacked above a heading it puts
          the toggle in the gap between the two, level with neither. */}
      <header className="header-stacked">
        <div>
          {/* A plain link rather than history.back(): this screen is
              bookmarkable, so there is not always a list to go back to. */}
          <Link className="back-link" to="/">
            ← All applications
          </Link>
          <h1>Insights</h1>
        </div>
        <div className="header-actions">
          <ThemeToggle />
        </div>
      </header>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : timeline && timeline.series.length > 0 ? (
        <StatusChart
          series={timeline.series}
          openingCount={timeline.opening_count}
        />
      ) : (
        // Reached only before anything has been tracked at all. Drawing an
        // empty pair of axes would look like a chart that failed to load.
        !error && (
          <p className="empty-state">
            Nothing to chart yet — status history starts with your first
            application.
          </p>
        )
      )}
    </>
  );
}
