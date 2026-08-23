import { STATUS_LABELS } from "./StatusBadge.jsx";

/**
 * How long an application sat in each status (KAN-43), read from the history
 * KAN-42 records.
 *
 * Durations are *inferred*, not stored: each entry runs until the next one, and
 * the last runs until now. That falls out of the table and needs no extra
 * column — but see the note rendered under the list about what the numbers
 * actually measure.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Deliberately coarse. A job search is measured in days and weeks, and "1 week"
 * is easier to act on than "8 days"; nobody chases a recruiter based on hours.
 */
export function humaniseDuration(ms) {
  if (ms < DAY) return "less than a day";

  const days = Math.floor(ms / DAY);
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;

  const weeks = Math.floor(days / 7);
  if (days < 60) return weeks === 1 ? "1 week" : `${weeks} weeks`;

  const months = Math.floor(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * Pairs each entry with the moment it ended — the next entry's timestamp, or
 * now for the one still running.
 */
export function toSpans(history, now = Date.now()) {
  return history.map((entry, i) => {
    const started = new Date(entry.changed_at).getTime();
    const next = history[i + 1];
    const ended = next ? new Date(next.changed_at).getTime() : now;
    return {
      id: entry.id,
      status: entry.to_status,
      startedAt: entry.changed_at,
      // Clamp at zero: clock skew between the server writing changed_at and
      // the browser reading Date.now() could otherwise show a negative span on
      // a change made seconds ago.
      duration: Math.max(0, ended - started),
      current: !next,
    };
  });
}

export default function StatusTimeline({ history, createdAt }) {
  if (!history || history.length === 0) return null;

  const spans = toSpans(history);

  // The applications that predate KAN-42 were backfilled with one row stamped
  // at the migration, not at creation — how they reached their current status
  // was never observed. Rendering that silently would imply the status changed
  // on the migration date, which is false.
  const historyStarts = new Date(history[0].changed_at).getTime();
  const recordStarts = createdAt ? new Date(createdAt).getTime() : null;
  const startsLate = recordStarts !== null && historyStarts - recordStarts > DAY;

  return (
    <section className="timeline">
      <h2>Status history</h2>

      <ol className="timeline-list">
        {spans.map((span) => (
          <li key={span.id} className={span.current ? "timeline-current" : undefined}>
            <span className={`badge badge-${span.status}`}>
              {STATUS_LABELS[span.status] || span.status}
            </span>
            <span className="timeline-from">from {shortDate(span.startedAt)}</span>
            <span className="timeline-duration">
              {humaniseDuration(span.duration)}
              {span.current && " so far"}
            </span>
          </li>
        ))}
      </ol>

      {startsLate && (
        <p className="timeline-note">
          Tracked since {shortDate(createdAt)}, but status history only begins{" "}
          {shortDate(history[0].changed_at)} — changes before then were not
          recorded.
        </p>
      )}

      {/* Stated once, quietly. §2.2: changed_at is when the record was edited,
          not when the thing happened, so a rejection noticed late charges that
          time to the previous status. */}
      <p className="timeline-note">
        Measured from when each change was recorded, not when it happened.
      </p>
    </section>
  );
}
