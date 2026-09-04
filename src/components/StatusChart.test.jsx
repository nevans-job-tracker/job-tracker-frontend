import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusChart, {
  bandPath,
  niceTicks,
  peakTotal,
  toBands,
  totalPath,
} from "./StatusChart.jsx";
import { STATUS_OPTIONS } from "../labels.js";

const day = (date, counts) => ({ date, counts });

describe("peakTotal", () => {
  it("is the tallest stack, not the tallest single band", () => {
    const series = [
      day("2026-09-01", { applied: 3 }),
      day("2026-09-02", { applied: 2, offer: 2 }),
    ];
    expect(peakTotal(series)).toBe(4);
  });

  it("is zero for an empty series", () => {
    expect(peakTotal([])).toBe(0);
  });
});

describe("toBands", () => {
  const series = [
    day("2026-09-01", { interested: 2 }),
    day("2026-09-02", { interested: 1, applied: 1 }),
  ];

  it("drops statuses absent from the whole series", () => {
    // Nine bands where three are in the data would put six empty entries in
    // the legend and six zero-height slivers on the chart.
    const bands = toBands(series);
    expect(bands.map((b) => b.status)).toEqual(["interested", "applied"]);
  });

  it("stacks in STATUS_OPTIONS order, bottom first", () => {
    // A band must not swap places with its neighbour between days — the shape
    // would be meaningless. Fixing the order to the lifecycle is what
    // guarantees it, and it also means the chart reads upward the way the
    // lifecycle runs.
    const bands = toBands(series);
    const positions = bands.map((b) => STATUS_OPTIONS.indexOf(b.status));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("puts the tallest stack at the top of the plot", () => {
    const bands = toBands(series, { width: 100, height: 100 });
    // Day one holds two applications, which is the peak, so the top of the
    // stack is y=0 — SVG counts downward.
    expect(bands[0].points[0].y1).toBe(0);
  });

  it("rests every stack on the baseline", () => {
    const bands = toBands(series, { width: 100, height: 100 });
    expect(bands[0].points.every((p) => p.y0 === 100)).toBe(true);
  });

  it("stacks each band on top of the one below", () => {
    const bands = toBands(series, { width: 100, height: 100 });
    const [interested, applied] = bands;
    // The second band starts where the first one ends, on the day both exist.
    expect(applied.points[1].y0).toBe(interested.points[1].y1);
  });

  it("spans the full width", () => {
    const bands = toBands(series, { width: 100, height: 100 });
    expect(bands[0].points.map((p) => p.x)).toEqual([0, 100]);
  });

  it("does not divide by zero on a single day", () => {
    const bands = toBands([day("2026-09-01", { applied: 1 })], {
      width: 100,
      height: 100,
    });
    expect(bands[0].points).toEqual([{ x: 0, y0: 100, y1: 0 }]);
  });
});

describe("bandPath", () => {
  it("closes the polygon, running back along the bottom", () => {
    const path = bandPath([
      { x: 0, y0: 10, y1: 0 },
      { x: 5, y0: 10, y1: 2 },
    ]);
    expect(path).toBe("M0.00,0.00L5.00,2.00L5.00,10.00L0.00,10.00Z");
  });
});

describe("totalPath", () => {
  it("traces the top edge of the topmost band", () => {
    // The top of the stack *is* the total. Computing it separately would let
    // the line disagree with the bands beneath it.
    const bands = toBands(
      [day("2026-09-01", { interested: 1, applied: 1 })],
      { width: 100, height: 100 }
    );
    expect(totalPath(bands)).toBe("M0.00,0.00");
  });

  it("is empty when there is nothing to trace", () => {
    expect(totalPath([])).toBe("");
  });
});

describe("niceTicks", () => {
  it("uses round numbers rather than fractions of the peak", () => {
    expect(niceTicks(130)).toEqual([0, 50, 100]);
  });

  it("starts at zero", () => {
    expect(niceTicks(7)[0]).toBe(0);
  });

  it("never exceeds the peak", () => {
    for (const peak of [1, 3, 9, 27, 130, 1001]) {
      expect(Math.max(...niceTicks(peak))).toBeLessThanOrEqual(peak);
    }
  });

  it("degrades to a single tick with no data", () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});

describe("StatusChart", () => {
  const series = [
    day("2026-08-01", { interested: 2 }),
    day("2026-08-02", { interested: 1, applied: 1 }),
    day("2026-08-03", { applied: 1, offer: 1 }),
  ];

  it("renders nothing for an empty series", () => {
    const { container } = render(<StatusChart series={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one band per status present", () => {
    const { container } = render(<StatusChart series={series} />);
    expect(container.querySelectorAll(".chart-band")).toHaveLength(3);
  });

  it("gives each band the status class the badges use", () => {
    // The whole colour scheme rests on this: .band-* reads the same
    // --badge-*-bg token, so a band and a badge cannot drift apart and dark
    // mode needs no chart-specific work.
    const { container } = render(<StatusChart series={series} />);
    expect(container.querySelector(".band-offer")).toBeInTheDocument();
    expect(container.querySelector(".band-interested")).toBeInTheDocument();
  });

  it("shows today's counts in the legend", () => {
    render(<StatusChart series={series} />);
    const legend = screen.getByRole("list");
    expect(legend).toHaveTextContent("Offer");
    expect(legend).toHaveTextContent("Applied");
  });

  it("orders the legend top band first", () => {
    render(<StatusChart series={series} />);
    const labels = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent.replace(/\d+$/, ""));
    // Offer stacks above Applied above Interested, so it leads here.
    expect(labels).toEqual(["Offer", "Applied", "Interested"]);
  });

  it("always states what the dates measure", () => {
    // §2.2: changed_at is when the record was edited, not when the thing
    // happened. Rendering a chart of it without saying so overstates it.
    render(<StatusChart series={series} />);
    expect(
      screen.getByText(/recorded, not when it happened/i)
    ).toBeInTheDocument();
  });

  it("calls out the step at the left edge", () => {
    render(<StatusChart series={series} openingCount={128} />);
    expect(screen.getByText(/128 applications enter on the first day/)).toBeInTheDocument();
  });

  it("says nothing about the left edge when only one record opens it", () => {
    // The note is rendered from a number so it shrinks as real history
    // accumulates. One application starting on day one is just a start.
    render(<StatusChart series={series} openingCount={1} />);
    expect(screen.queryByText(/enter on the first day/)).not.toBeInTheDocument();
  });

  it("labels the axis with dates that are not off by one", () => {
    // A plain ISO date parses as midnight UTC, which is the previous day in
    // every western timezone — so every label would read a day early.
    render(<StatusChart series={series} />);

    // Built from parts rather than parsed, so the expectation cannot inherit
    // the bug, and formatted the same way so the assertion is not about the
    // test runner's locale.
    const expected = (y, m, d) =>
      new Date(y, m, d).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });

    expect(screen.getByText(expected(2026, 7, 1))).toBeInTheDocument();
    expect(screen.getByText(expected(2026, 7, 3))).toBeInTheDocument();
  });

  it("describes itself for a screen reader", () => {
    render(<StatusChart series={series} />);
    expect(
      screen.getByRole("img", { name: /from 2026-08-01 to 2026-08-03/ })
    ).toBeInTheDocument();
  });
});
