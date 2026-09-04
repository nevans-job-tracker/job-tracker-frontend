import { STATUS_LABELS, STATUS_OPTIONS } from "../labels.js";

/**
 * A stacked area of how many applications sat in each status, day by day
 * (KAN-70), reading the history KAN-42 records.
 *
 * **Hand-rolled SVG rather than a charting library.** The initial bundle is
 * ~207 KB and mammoth is lazy-loaded specifically to keep it there (KAN-41); a
 * charting library is that budget again for one screen. What is actually
 * needed here is a polygon per status and a few text labels.
 *
 * **A stacked area rather than a funnel or a time-in-stage bar.** Both of
 * those encode a claim about a *process* — "128 saved, 44 moved on, 1 applied"
 * reads as a conversion rate — and that claim is false while the search is
 * still mostly a shortlist. A stacked area claims only "this is what the
 * tracker held on these days", which is true at any volume and corrects itself
 * as the shape of the data changes.
 *
 * Colours come from the `--badge-*` tokens through a class per status, exactly
 * as StatusBadge does. That is what makes a band here and a badge in the list
 * the same colour, and it is what makes dark mode work without the chart
 * knowing dark mode exists.
 */

// Room for the y-axis numbers on the left and the date labels underneath. The
// viewBox is fixed and the SVG scales to its container, so these are ratios in
// disguise rather than pixels anyone will measure.
const WIDTH = 720;
const HEIGHT = 320;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/**
 * The tallest stack in the series — the y-axis ceiling.
 *
 * Every day's counts sum to the number of applications that existed that day,
 * so this is the total on the last day in all but pathological cases. Computed
 * over the whole series regardless, because nothing guarantees that: an
 * application is never removed, but the series is derived and a future filter
 * could make it shrink.
 */
export function peakTotal(series) {
  return series.reduce((max, point) => {
    const total = Object.values(point.counts).reduce((a, b) => a + b, 0);
    return Math.max(max, total);
  }, 0);
}

/**
 * Turns the day-by-day counts into one band per status, bottom to top in
 * STATUS_OPTIONS order — so the lifecycle reads upward from Interested and a
 * band never swaps places with its neighbour between days.
 *
 * Each band is a list of `{ x, y0, y1 }` in *plot* coordinates. Statuses that
 * are absent from the whole series are dropped rather than drawn as a
 * zero-height sliver, which would put nine entries in the legend when three
 * are in the data.
 */
export function toBands(series, { width = PLOT_W, height = PLOT_H } = {}) {
  const peak = peakTotal(series) || 1;
  // A single day has no width to interpolate across, so it would divide by
  // zero. Pinning it to the left edge draws one vertical line, which is an
  // honest picture of one day of data.
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  const scaleY = (value) => height - (value / peak) * height;

  const present = STATUS_OPTIONS.filter((status) =>
    series.some((point) => (point.counts[status] || 0) > 0)
  );

  const running = series.map(() => 0);

  return present.map((status) => ({
    status,
    points: series.map((point, i) => {
      const y0 = running[i];
      const y1 = y0 + (point.counts[status] || 0);
      running[i] = y1;
      return { x: i * step, y0: scaleY(y0), y1: scaleY(y1) };
    }),
  }));
}

/**
 * A closed polygon: along the top of the band left to right, back along its
 * bottom right to left.
 */
export function bandPath(points) {
  const top = points.map((p) => `${p.x.toFixed(2)},${p.y1.toFixed(2)}`);
  const bottom = points
    .slice()
    .reverse()
    .map((p) => `${p.x.toFixed(2)},${p.y0.toFixed(2)}`);
  return `M${top.join("L")}L${bottom.join("L")}Z`;
}

/**
 * The top edge of the whole stack, which *is* the total — so it is stroked
 * rather than drawn as a separate series. A second line computed independently
 * could disagree with the bands under it, and the one thing a stacked chart
 * must not do is contradict itself.
 */
export function totalPath(bands) {
  if (bands.length === 0) return "";
  const top = bands[bands.length - 1].points;
  return `M${top.map((p) => `${p.x.toFixed(2)},${p.y1.toFixed(2)}`).join("L")}`;
}

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

// Read at midday rather than midnight. The series carries plain dates, and
// `new Date("2026-09-04")` is midnight UTC — which is the previous day in
// every western timezone, so every label would be off by one.
const shortDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export default function StatusChart({ series, openingCount = 0 }) {
  if (!series || series.length === 0) return null;

  const bands = toBands(series);
  const peak = peakTotal(series);
  const ticks = niceTicks(peak);
  const step = series.length > 1 ? PLOT_W / (series.length - 1) : 0;
  const last = series.length - 1;

  // First, last, and the middle when there is room — enough to place the shape
  // in time without turning the axis into a wall of dates.
  const labelIndexes = series.length > 2 ? [0, Math.floor(last / 2), last] : [0];

  const latest = series[last].counts;

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`Applications by status from ${series[0].date} to ${series[last].date}`}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {ticks.map((value) => {
            const y = PLOT_H - (value / (peak || 1)) * PLOT_H;
            return (
              <g key={value}>
                <line className="chart-grid" x1={0} x2={PLOT_W} y1={y} y2={y} />
                <text className="chart-tick" x={-6} y={y} dy="0.32em" textAnchor="end">
                  {value}
                </text>
              </g>
            );
          })}

          {bands.map((band) => (
            <path
              key={band.status}
              className={`chart-band band-${band.status}`}
              d={bandPath(band.points)}
            />
          ))}

          <path className="chart-total" d={totalPath(bands)} />

          {labelIndexes.map((i) => (
            <text
              key={i}
              className="chart-tick"
              x={i * step}
              y={PLOT_H + 18}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            >
              {shortDate(series[i].date)}
            </text>
          ))}
        </g>
      </svg>

      {/* The legend doubles as today's tally, so the screen answers "where are
          they now" without reading values off the right-hand edge. Ordered top
          band first, so it reads in the same direction as the chart. */}
      <ul className="chart-legend">
        {bands
          .slice()
          .reverse()
          .map((band) => (
            <li key={band.status}>
              <span className={`chart-swatch band-${band.status}`} aria-hidden="true" />
              {STATUS_LABELS[band.status] || band.status}
              <span className="chart-legend-count">{latest[band.status] || 0}</span>
            </li>
          ))}
      </ul>

      {/* Rendered from a number rather than asserted as a sentence, so it
          shrinks as real history accumulates instead of going stale. §2.2: the
          applications predating KAN-42 were stamped at the migration, so the
          left edge is a step and not a slope. */}
      {openingCount > 1 && (
        <p className="chart-note">
          {openingCount} applications enter on the first day — recording began
          then, so the left edge is a step rather than something that happened
          that day.
        </p>
      )}

      <p className="chart-note">
        Counted from when each change was recorded, not when it happened.
      </p>
    </div>
  );
}
