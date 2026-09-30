/**
 * Geometry and formatting shared by the insights charts.
 *
 * Extracted when the second chart arrived (KAN-90). Both need the same axis
 * ticks and the same date formatting, and the alternative was importing them
 * from a sibling component or writing them twice — the duplication `labels.js`
 * exists to prevent, one file earlier in its life.
 *
 * Pure functions on purpose, as `StatusChart.jsx` already does with its band
 * geometry: they are tested directly rather than through the DOM, which is the
 * only way to test any of this given jsdom does not lay out (§5).
 */

/**
 * Tick values a person reads without counting: 1, 2, 5 and their decades.
 */
export function niceTicks(peak, count = 4) {
  if (peak <= 0) return [0];
  const raw = peak / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);

  const ticks = [];
  for (let value = 0; value <= peak; value += step) ticks.push(value);
  return ticks;
}

/**
 * Read at midday rather than midnight. The series carries plain dates, and
 * `new Date("2026-09-04")` is midnight UTC — which is the previous day in
 * every western timezone, so every label would be off by one.
 *
 * The same trap KAN-84 found in the other direction, where building a date
 * *from* the clock via `toISOString()` returned tomorrow after 20:00 Eastern.
 * Dates in this app are plain dates; only the local parts are ever correct.
 */
export function chartDate(iso) {
  return new Date(`${iso}T12:00:00`);
}

/** "4 Sep" — an axis label, short enough to repeat across the bottom. */
export function shortDate(iso) {
  return chartDate(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** "Friday, 4 September 2026" — a readout, where the exact day is the point. */
export function longDate(iso) {
  return chartDate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
