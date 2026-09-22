import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge.jsx";
import { STATUS_LABELS, STATUS_OPTIONS } from "../labels.js";

describe("StatusBadge", () => {
  it("shows the readable label rather than the stored value", () => {
    render(<StatusBadge status="phone_screen" />);
    expect(screen.getByText("Phone Screen")).toBeInTheDocument();
  });

  it("falls back to the raw value for a status it does not know", () => {
    // The column is writable through the API, so an unmapped value is
    // possible. Showing it raw is wrong-looking; showing nothing would hide
    // that the row has a status at all.
    render(<StatusBadge status="something_else" />);
    expect(screen.getByText("something_else")).toBeInTheDocument();
  });
});

describe("the posting-closed badge (KAN-57)", () => {
  it("renders its readable label", () => {
    render(<StatusBadge status="posting_closed" />);
    expect(screen.getByText("Posting Closed")).toBeInTheDocument();
  });

  it("carries its own class, not a decision colour", () => {
    // §4.4: the badges are not inverted or grouped mechanically. Nothing was
    // decided about the candidate here, so it must not wear rejected's red.
    render(<StatusBadge status="posting_closed" />);
    const badge = screen.getByText("Posting Closed");
    expect(badge).toHaveClass("badge-posting_closed");
    expect(badge).not.toHaveClass("badge-rejected");
  });
});

describe("the scam badge (KAN-79)", () => {
  it("renders its readable label", () => {
    render(<StatusBadge status="scam" />);
    expect(screen.getByText("Scam")).toBeInTheDocument();
  });

  it("does not wear rejected's red or posting_closed's grey", () => {
    // The two nearest statuses are the two wrong facts. `rejected` says an
    // employer considered you; `posting_closed` says a real opportunity ended.
    // A scam is neither, and the colour is what carries that at a glance.
    render(<StatusBadge status="scam" />);
    const badge = screen.getByText("Scam");
    expect(badge).toHaveClass("badge-scam");
    expect(badge).not.toHaveClass("badge-rejected");
    expect(badge).not.toHaveClass("badge-posting_closed");
  });
});

describe("the duplicate badge (KAN-86)", () => {
  it("renders its readable label", () => {
    render(<StatusBadge status="duplicate" />);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });

  it("does not wear either of the other two neutrals", () => {
    // It belongs to the neutral family — bookkeeping rather than an outcome —
    // but `ghosted` already holds the cool grey and `posting_closed` the light
    // slate. A third light neutral would be unreadable where those three meet
    // edge to edge as bands, so it has its own token pair and its own class.
    render(<StatusBadge status="duplicate" />);
    const badge = screen.getByText("Duplicate");
    expect(badge).toHaveClass("badge-duplicate");
    expect(badge).not.toHaveClass("badge-ghosted");
    expect(badge).not.toHaveClass("badge-posting_closed");
  });

  it("reads last in the dropdown, outside the run of outcomes", () => {
    // The nine before it say what happened to the application or the posting.
    // This one says the tracker is holding the same job twice, which is not an
    // outcome at all — so it sits after the terminal states rather than among
    // them. Pinned because the order is the frontend's alone; the database
    // appends, and a reorder here is silent.
    expect(STATUS_OPTIONS[STATUS_OPTIONS.length - 1]).toBe("duplicate");
  });
});

describe("every status has a label and a badge class", () => {
  // index.css defines one rule per status. A value added to the enum and to
  // STATUS_LABELS but not to the stylesheet renders unstyled, which is easy
  // to miss because the text still reads correctly.
  it.each(Object.keys(STATUS_LABELS))("%s", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(STATUS_LABELS[status])).toHaveClass(
      `badge-${status}`
    );
  });
});
