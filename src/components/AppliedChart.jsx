import { useRef, useState } from "react";
import { longDate, niceTicks, shortDate } from "../chart.js";

/**
 * How many applications were *sent* on each day (KAN-90).
 *
 * **Reads `date_applied`, not the history table**, which §2.2 decided before
 * either chart existed: `changed_at` records when a row was edited, so a batch
 * entered on Sunday evening would all land on Sunday. See
 * `crud.applications_per_day`.
 *
 * **A line with a marker per day, not a bar per day.** Bars are the textbook
 * encoding for a daily count, and the deciding factor was elsewhere: the point
 * of this chart is reading one specific day off it, and a marker is a thing to
 * aim at. KAN-91 makes those markers open the day's applications, so they have
 * to exist as targets either way.
 *
 * The line only claims what the series claims, because the series carries an
 * explicit zero for every quiet day. It descends to the axis and back rather
 * than joining across a gap, so it never draws activity that did not happen.
 *
 * **Hand-rolled SVG, still** (KAN-70). A tooltip is the part that makes a
 * charting library tempting; it is still not worth roughly the initial bundle
 * again for one screen.
 */

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 14, right: 14, bottom: 28, left: 36 };

const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** The busiest day — the y-axis ceiling. */
export function peakCount(series) {
  return series.reduce((max, point) => Math.max(max, point.count), 0);
}

/**
 * One `{ x, y, date, count }` per day, in plot coordinates.
 *
 * A single day has no width to spread across, so it pins to the left edge
 * rather than dividing by zero — the same guard `toBands` carries.
 */
export function toPoints(series, { width = PLOT_W, height = PLOT_H } = {}) {
  const peak = peakCount(series) || 1;
  const step = series.length > 1 ? width / (series.length - 1) : 0;

  return series.map((point, i) => ({
    x: i * step,
    y: height - (point.count / peak) * height,
    date: point.date,
    count: point.count,
  }));
}

export function linePath(points) {
  if (points.length === 0) return "";
  return `M${points
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join("L")}`;
}

/**
 * Which day a pointer at `ratio` across the plot is nearest to.
 *
 * Nearest-on-the-x-axis rather than a hit area per marker, and that is a
 * mobile decision rather than a convenience. §1 makes the phone a real target,
 * and the project's touch target is 36px (KAN-58, KAN-73) — at three weeks of
 * daily points those would overlap, so per-marker areas would leave days
 * unreachable by thumb. This way every horizontal position selects something.
 */
export function nearestIndex(ratio, length) {
  if (length <= 0) return null;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(clamped * (length - 1));
}

export default function AppliedChart({ series }) {
  const plotRef = useRef(null);
  const [selected, setSelected] = useState(null);

  if (!series || series.length === 0) return null;

  const points = toPoints(series);
  const peak = peakCount(series);
  const ticks = niceTicks(peak);
  const last = series.length - 1;
  const total = series.reduce((sum, point) => sum + point.count, 0);

  // First, last and the middle when there is room — enough to place the shape
  // in time without turning the axis into a wall of dates.
  const labelIndexes = series.length > 2 ? [0, Math.floor(last / 2), last] : [0];

  const selectFromEvent = (event) => {
    const box = plotRef.current?.getBoundingClientRect();
    // jsdom reports zeros for every rect, and a real pointer can land on a
    // zero-width box mid-layout. Neither should throw or select day zero.
    if (!box || box.width === 0) return;
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    if (clientX == null) return;
    setSelected(nearestIndex((clientX - box.left) / box.width, series.length));
  };

  const onKeyDown = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setSelected((current) => {
      const from = current == null ? last : current;
      return Math.min(last, Math.max(0, from + step));
    });
  };

  const active = selected == null ? null : points[selected];

  // Keep the readout inside the plot. Near the right edge it would otherwise
  // run off the viewBox, so it flips to sit left of the marker instead.
  const READOUT_W = 132;
  const readoutX = active
    ? Math.min(Math.max(active.x - READOUT_W / 2, 0), PLOT_W - READOUT_W)
    : 0;
  const readoutBelow = active ? active.y < 54 : false;
  const readoutY = active ? (readoutBelow ? active.y + 14 : active.y - 50) : 0;

  return (
    <div className="chart">
      <h2 className="chart-heading">Applications sent per day</h2>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`Applications sent per day from ${series[0].date} to ${series[last].date}, ${total} in total`}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {ticks.map((value) => {
            const y = PLOT_H - (value / (peak || 1)) * PLOT_H;
            return (
              <g key={value}>
                <line className="chart-grid" x1={0} x2={PLOT_W} y1={y} y2={y} />
                <text
                  className="chart-tick"
                  x={-6}
                  y={y}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {value}
                </text>
              </g>
            );
          })}

          <path className="applied-line" d={linePath(points)} />

          {points.map((point, i) => (
            <circle
              key={point.date}
              className={
                i === selected ? "applied-dot applied-dot-on" : "applied-dot"
              }
              cx={point.x}
              cy={point.y}
              r={i === selected ? 5 : 3}
            />
          ))}

          {active && (
            <g className="applied-readout" pointerEvents="none">
              <line
                className="applied-rule"
                x1={active.x}
                x2={active.x}
                y1={0}
                y2={PLOT_H}
              />
              <rect x={readoutX} y={readoutY} width={READOUT_W} height={36} rx={4} />
              <text x={readoutX + 8} y={readoutY + 15}>
                {shortDate(active.date)}
              </text>
              <text x={readoutX + 8} y={readoutY + 29} className="applied-readout-count">
                {active.count} {active.count === 1 ? "application" : "applications"}
              </text>
            </g>
          )}

          {labelIndexes.map((i) => (
            <text
              key={i}
              className="chart-tick"
              x={points[i].x}
              y={PLOT_H + 18}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            >
              {shortDate(series[i].date)}
            </text>
          ))}

          {/* One transparent surface over the whole plot rather than a target
              per marker — see nearestIndex. Focusable so the chart can be read
              with the keyboard, which is the one input method a tooltip on
              hover otherwise excludes entirely. */}
          <rect
            ref={plotRef}
            className="applied-surface"
            x={0}
            y={0}
            width={PLOT_W}
            height={PLOT_H}
            tabIndex={0}
            role="slider"
            aria-label="Pick a day to read its exact date and count"
            aria-valuemin={0}
            aria-valuemax={last}
            aria-valuenow={selected ?? last}
            aria-valuetext={
              active
                ? `${longDate(active.date)}, ${active.count} applications`
                : "No day selected"
            }
            onMouseMove={selectFromEvent}
            onMouseLeave={() => setSelected(null)}
            onTouchStart={selectFromEvent}
            onTouchMove={selectFromEvent}
            onClick={selectFromEvent}
            onKeyDown={onKeyDown}
            onBlur={() => setSelected(null)}
          />
        </g>
      </svg>

      {/* The readout in text as well as on the chart. A tooltip that exists
          only inside the SVG is unreadable to a screen reader and gone the
          moment a thumb lifts, so the exact answer also lands here where it
          stays. aria-live because the chart itself cannot announce. */}
      <p className="chart-note" aria-live="polite">
        {active
          ? `${longDate(active.date)}: ${active.count} ${
              active.count === 1 ? "application" : "applications"
            }`
          : `${total} applications over ${series.length} days. Hover, tap or arrow along the chart for one day's exact count.`}
      </p>

      {/* Not a caveat about accuracy but about coverage, and it is the thing
          most likely to be misread: most of the tracker is a shortlist never
          applied to (KAN-31), so this counts a minority of records on
          purpose. It is applications sent, not activity. */}
      <p className="chart-note">
        Counts the day each application was sent. Records with no applied date
        are not on this chart.
      </p>
    </div>
  );
}
