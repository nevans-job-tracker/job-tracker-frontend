import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import StatusTimeline, {
  humaniseDuration,
  toSpans,
} from "./StatusTimeline.jsx";

const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

const change = (id, to, daysAgo, from = null) => ({
  id,
  from_status: from,
  to_status: to,
  changed_at: at(daysAgo),
});

describe("humaniseDuration", () => {
  it.each([
    [0, "less than a day"],
    [DAY - 1, "less than a day"],
    [DAY, "1 day"],
    [3 * DAY, "3 days"],
    [13 * DAY, "13 days"],
    [14 * DAY, "2 weeks"],
    [21 * DAY, "3 weeks"],
    [59 * DAY, "8 weeks"],
    [60 * DAY, "2 months"],
    [400 * DAY, "13 months"],
  ])("%i ms reads as %s", (ms, expected) => {
    expect(humaniseDuration(ms)).toBe(expected);
  });

  it("says 7 days rather than 1 week", () => {
    // Deliberately coarse only past a fortnight: a week into an application,
    // "7 days" is the number you are actually counting.
    expect(humaniseDuration(7 * DAY)).toBe("7 days");
  });

  it("never says 1 days", () => {
    expect(humaniseDuration(DAY)).not.toContain("1 days");
  });
});

describe("toSpans", () => {
  it("runs each entry until the next one", () => {
    const spans = toSpans([change(1, "applied", 10), change(2, "interview", 4)]);
    expect(humaniseDuration(spans[0].duration)).toBe("6 days");
  });

  it("runs the last entry until now and marks it current", () => {
    const spans = toSpans([change(1, "applied", 3)]);
    expect(spans[0].current).toBe(true);
    expect(humaniseDuration(spans[0].duration)).toBe("3 days");
  });

  it("marks only the last entry as current", () => {
    const spans = toSpans([
      change(1, "applied", 10),
      change(2, "interview", 4),
      change(3, "offer", 1),
    ]);
    expect(spans.map((s) => s.current)).toEqual([false, false, true]);
  });

  it("clamps a negative span to zero", () => {
    // The server writes changed_at; the browser reads Date.now(). Clock skew
    // could otherwise show a negative duration on a change made seconds ago.
    const spans = toSpans([change(1, "applied", -1)]);
    expect(spans[0].duration).toBe(0);
  });

  it("keeps a repeated status as separate entries", () => {
    // §3 allows any transition, so rejected -> interview -> rejected is
    // ordinary and must not be collapsed.
    const spans = toSpans([
      change(1, "rejected", 9),
      change(2, "interview", 6, "rejected"),
      change(3, "rejected", 2, "interview"),
    ]);
    expect(spans.map((s) => s.status)).toEqual([
      "rejected",
      "interview",
      "rejected",
    ]);
  });
});

describe("StatusTimeline", () => {
  const created = at(30);

  it("renders nothing without history", () => {
    const { container } = render(
      <StatusTimeline history={[]} createdAt={created} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when history is missing entirely", () => {
    const { container } = render(<StatusTimeline createdAt={created} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each status with its readable label", () => {
    render(
      <StatusTimeline
        history={[change(1, "phone_screen", 5)]}
        createdAt={at(5)}
      />
    );
    expect(screen.getByText("Phone Screen")).toBeInTheDocument();
  });

  it("shows how long each status lasted", () => {
    render(
      <StatusTimeline
        history={[change(1, "applied", 12), change(2, "interview", 5)]}
        createdAt={at(12)}
      />
    );
    expect(screen.getByText("7 days")).toBeInTheDocument();
  });

  it("marks the running status as so far rather than finished", () => {
    render(
      <StatusTimeline history={[change(1, "applied", 4)]} createdAt={at(4)} />
    );
    expect(screen.getByText(/4 days\s*so far/)).toBeInTheDocument();
  });

  it("says when history begins later than the record does", () => {
    // The applications that predate KAN-42 were backfilled at the migration,
    // not at creation. Rendering that silently would claim the status changed
    // on the migration date.
    render(
      <StatusTimeline history={[change(1, "interested", 2)]} createdAt={at(30)} />
    );
    expect(
      screen.getByText(/status history only begins/i)
    ).toBeInTheDocument();
  });

  it("stays quiet when history starts with the record", () => {
    render(
      <StatusTimeline history={[change(1, "applied", 5)]} createdAt={at(5)} />
    );
    expect(
      screen.queryByText(/status history only begins/i)
    ).not.toBeInTheDocument();
  });

  it("stays quiet when the record has no created_at", () => {
    render(<StatusTimeline history={[change(1, "applied", 5)]} />);
    expect(
      screen.queryByText(/status history only begins/i)
    ).not.toBeInTheDocument();
  });

  it("says what the durations actually measure", () => {
    // §2.2: changed_at is when the record was edited, not when it happened.
    render(
      <StatusTimeline history={[change(1, "applied", 5)]} createdAt={at(5)} />
    );
    expect(
      screen.getByText(/when each change was recorded, not when it happened/i)
    ).toBeInTheDocument();
  });

  it("lists entries oldest first, as the API returns them", () => {
    render(
      <StatusTimeline
        history={[
          change(1, "interested", 20),
          change(2, "applied", 15, "interested"),
          change(3, "offer", 2, "applied"),
        ]}
        createdAt={at(20)}
      />
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Interested")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Offer")).toBeInTheDocument();
  });
});
