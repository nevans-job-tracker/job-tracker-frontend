import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAppliedPerDay, getStatusTimeline } from "../api/client.js";
import AppliedChart from "../components/AppliedChart.jsx";
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
  const [applied, setApplied] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // allSettled rather than all, so one endpoint failing costs its own
      // chart and not the page. That is KAN-56's rule for the source filter
      // applied to a screen with two independent reads: losing one thing
      // should lose that thing.
      const [status, perDay] = await Promise.allSettled([
        getStatusTimeline(),
        getAppliedPerDay(),
      ]);
      if (cancelled) return;

      if (status.status === "fulfilled") setTimeline(status.value);
      if (perDay.status === "fulfilled") setApplied(perDay.value);

      const failed = [status, perDay].find((r) => r.status === "rejected");
      if (failed) setError(failed.reason.message);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasApplied = applied && applied.series.length > 0;
  const hasTimeline = timeline && timeline.series.length > 0;

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
      ) : (
        <>
          {hasTimeline && (
            <StatusChart
              series={timeline.series}
              openingCount={timeline.opening_count}
            />
          )}

          {/* Below the status chart rather than above it. That one answers
              "how is it going", which is why the screen exists; this answers
              "what have I been doing", which is the narrower question. Purely
              an ordering call, and a one-line change if reading it the other
              way round turns out to be better. */}
          {hasApplied && <AppliedChart series={applied.series} />}

          {/* Each chart has its own empty case, and they are not the same
              one: history begins at the first record, but this chart needs a
              record that was actually *applied to*, which most are not
              (KAN-31). Saying so separately stops a shortlist with no
              applications looking like a screen that failed to load. */}
          {!hasApplied && !error && (
            <p className="empty-state">
              {hasTimeline
                ? "No applications have been sent yet, so there is nothing to chart per day."
                : "Nothing to chart yet — status history starts with your first application."}
            </p>
          )}
        </>
      )}
    </>
  );
}
