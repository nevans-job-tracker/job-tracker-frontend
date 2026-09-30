import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { longDate } from "../chart.js";
import AppliedChart, {
  linePath,
  nearestIndex,
  peakCount,
  toPoints,
} from "./AppliedChart.jsx";

const day = (date, count) => ({ date, count });

const series = [
  day("2026-09-10", 2),
  day("2026-09-11", 0),
  day("2026-09-12", 6),
  day("2026-09-13", 1),
];

/**
 * jsdom reports a zero rect for everything, so the pointer handlers can never
 * resolve a position on their own. Giving the surface a real box is what lets
 * the interaction be tested at all; the geometry it feeds is covered directly
 * by the pure functions above, which is the split §5 asks for.
 */
function withPlotWidth(container, width = 400, left = 0) {
  const surface = container.querySelector(".applied-surface");
  surface.getBoundingClientRect = () => ({
    left,
    width,
    right: left + width,
    top: 0,
    bottom: 200,
    height: 200,
    x: left,
    y: 0,
  });
  return surface;
}

describe("peakCount", () => {
  it("is the busiest day", () => {
    expect(peakCount(series)).toBe(6);
  });

  it("is zero for an empty series", () => {
    expect(peakCount([])).toBe(0);
  });

  it("is zero when every day is quiet, without dividing by it", () => {
    // toPoints falls back to 1 so a flat zero line sits on the axis rather
    // than producing NaN coordinates.
    expect(peakCount([day("2026-09-10", 0)])).toBe(0);
    expect(toPoints([day("2026-09-10", 0)])[0].y).not.toBeNaN();
  });
});

describe("toPoints", () => {
  it("spreads the days evenly across the plot", () => {
    const points = toPoints(series, { width: 300, height: 100 });
    expect(points.map((p) => p.x)).toEqual([0, 100, 200, 300]);
  });

  it("puts the busiest day at the top and a quiet day on the axis", () => {
    const points = toPoints(series, { width: 300, height: 100 });
    // SVG counts downward, so the peak is y=0 and zero is the full height.
    expect(points[2].y).toBe(0);
    expect(points[1].y).toBe(100);
  });

  it("pins a single day to the left edge rather than dividing by zero", () => {
    const points = toPoints([day("2026-09-10", 3)], { width: 300, height: 100 });
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(0);
  });

  it("carries the date and count through for the readout", () => {
    expect(toPoints(series)[2]).toMatchObject({ date: "2026-09-12", count: 6 });
  });
});

describe("linePath", () => {
  it("draws one segment per day, in order", () => {
    const path = linePath(toPoints(series, { width: 300, height: 100 }));
    expect(path.startsWith("M0.00,")).toBe(true);
    expect(path.split("L")).toHaveLength(4);
  });

  it("is empty for an empty series", () => {
    expect(linePath([])).toBe("");
  });
});

describe("nearestIndex", () => {
  // Nearest on the x-axis rather than a hit area per marker: §1 makes the
  // phone real and the project's touch target is 36px, which at daily
  // resolution would overlap and leave days unreachable by thumb.
  it("rounds to the closest day", () => {
    expect(nearestIndex(0, 4)).toBe(0);
    expect(nearestIndex(0.3, 4)).toBe(1);
    expect(nearestIndex(0.7, 4)).toBe(2);
    expect(nearestIndex(1, 4)).toBe(3);
  });

  it("clamps rather than running off either end", () => {
    expect(nearestIndex(-3, 4)).toBe(0);
    expect(nearestIndex(9, 4)).toBe(3);
  });

  it("has nothing to select in an empty series", () => {
    expect(nearestIndex(0.5, 0)).toBeNull();
  });
});

describe("AppliedChart", () => {
  it("renders nothing at all for an empty series", () => {
    const { container } = render(<AppliedChart series={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("draws a marker per day", () => {
    const { container } = render(<AppliedChart series={series} />);
    expect(container.querySelectorAll(".applied-dot")).toHaveLength(4);
  });

  it("summarises the range before anything is picked", () => {
    render(<AppliedChart series={series} />);
    expect(screen.getByText(/9 applications over 4 days/)).toBeInTheDocument();
  });

  it("says what the chart does not cover", () => {
    // Most of the tracker is a shortlist never applied to (KAN-31), so this
    // counts a minority of records on purpose.
    render(<AppliedChart series={series} />);
    expect(
      screen.getByText(/Records with no applied date are not on this chart/)
    ).toBeInTheDocument();
  });
});

describe("reading one day off the chart (KAN-90)", () => {
  const readout = () => screen.getByRole("slider");

  it("shows the exact date and count on hover", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    fireEvent.mouseMove(surface, { clientX: 267 });

    // 267/400 rounds to index 2 — the busiest day.
    expect(screen.getByText(`${longDate("2026-09-12")}: 6 applications`)).toBeInTheDocument();
  });

  it("says application in the singular for a day with one", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    fireEvent.mouseMove(surface, { clientX: 400 });

    expect(screen.getByText(`${longDate("2026-09-13")}: 1 application`)).toBeInTheDocument();
  });

  it("reports a quiet day as zero rather than skipping it", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    fireEvent.mouseMove(surface, { clientX: 133 });

    expect(screen.getByText(`${longDate("2026-09-11")}: 0 applications`)).toBeInTheDocument();
  });

  it("clears the readout when the pointer leaves", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    fireEvent.mouseMove(surface, { clientX: 267 });
    fireEvent.mouseLeave(surface);

    expect(screen.getByText(/9 applications over 4 days/)).toBeInTheDocument();
  });

  it("answers a tap, because hover does not exist on a phone", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    fireEvent.touchStart(surface, { touches: [{ clientX: 267 }] });

    expect(screen.getByText(`${longDate("2026-09-12")}: 6 applications`)).toBeInTheDocument();
  });

  it("can be read with the arrow keys", async () => {
    // The one input method a hover tooltip excludes entirely.
    render(<AppliedChart series={series} />);
    readout().focus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText(`${longDate("2026-09-12")}: 6 applications`)).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText(`${longDate("2026-09-11")}: 0 applications`)).toBeInTheDocument();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText(`${longDate("2026-09-12")}: 6 applications`)).toBeInTheDocument();
  });

  it("stops at both ends rather than wrapping", async () => {
    render(<AppliedChart series={series} />);
    readout().focus();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByText(`${longDate("2026-09-13")}: 1 application`)).toBeInTheDocument();

    await userEvent.keyboard(
      "{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}"
    );
    expect(screen.getByText(`${longDate("2026-09-10")}: 2 applications`)).toBeInTheDocument();
  });

  it("announces the selection to assistive technology", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    expect(readout()).toHaveAttribute("aria-valuetext", "No day selected");
    fireEvent.mouseMove(surface, { clientX: 267 });
    expect(readout()).toHaveAttribute(
      "aria-valuetext",
      `${longDate("2026-09-12")}, 6 applications`
    );
  });

  it("marks the selected day so the chart and the text agree", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    expect(container.querySelectorAll(".applied-dot-on")).toHaveLength(0);
    fireEvent.mouseMove(surface, { clientX: 267 });
    expect(container.querySelectorAll(".applied-dot-on")).toHaveLength(1);
  });

  it("clears the readout when focus leaves", async () => {
    // The keyboard counterpart of mouseleave. Without it a selection made
    // with the arrow keys would stay on screen after tabbing away, claiming
    // a day is being read when nothing is.
    render(<AppliedChart series={series} />);
    readout().focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(
      screen.getByText(`${longDate("2026-09-12")}: 6 applications`)
    ).toBeInTheDocument();

    // Tabbing away rather than calling blur() directly: React listens for
    // focusout, and a raw DOM call also lands outside act(), so the state
    // update would not have flushed by the assertion.
    await userEvent.tab();

    expect(screen.getByText(/9 applications over 4 days/)).toBeInTheDocument();
  });

  it("survives a zero-width plot rather than selecting day zero", () => {
    // jsdom's default, and a real pointer can land on a box mid-layout.
    const { container } = render(<AppliedChart series={series} />);
    const surface = container.querySelector(".applied-surface");

    fireEvent.mouseMove(surface, { clientX: 50 });

    expect(screen.getByText(/9 applications over 4 days/)).toBeInTheDocument();
  });

  it("keeps the readout inside the plot at the right-hand edge", () => {
    const { container } = render(<AppliedChart series={series} />);
    const surface = withPlotWidth(container);

    fireEvent.mouseMove(surface, { clientX: 400 });

    // Clamped, or the last day's readout would run off the viewBox.
    const box = container.querySelector(".applied-readout rect");
    const x = Number(box.getAttribute("x"));
    expect(x + Number(box.getAttribute("width"))).toBeLessThanOrEqual(670);
  });
});
