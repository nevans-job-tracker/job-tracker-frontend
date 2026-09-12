/**
 * Today as `YYYY-MM-DD`, in the reader's own timezone.
 *
 * `new Date().toISOString().slice(0, 10)` is the obvious way to write this and
 * is wrong for anyone west of UTC. It converts to UTC first, so in
 * America/New_York every call from 20:00 local onward returns *tomorrow* —
 * which is most of the evening, and this app is read from a phone at night.
 *
 * Read off the local parts instead. `formatAge` in `ApplicationList` already
 * does the same thing for the same reason; this is that reasoning extracted so
 * the two cannot drift.
 *
 * `now` is injectable so a test can pin a date rather than mock the clock,
 * matching `formatAge` and `csvFilename`.
 */
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
