import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationList from "./ApplicationList.jsx";

const APPLICATIONS = [
  {
    id: 1,
    company: "Northwind",
    role_title: "QA Engineer",
    location: "Austin, TX",
    source: "LinkedIn",
    status: "applied",
    salary_min: "90000.00",
    salary_max: "120000.00",
    salary_currency: "USD",
    date_applied: "2026-03-01",
    next_action: "Follow up",
    next_action_date: "2026-03-15",
  },
  {
    id: 2,
    company: "Globex",
    role_title: "Senior QA Engineer",
    location: null,
    source: null,
    status: "offer",
    salary_min: null,
    salary_max: null,
    salary_currency: "USD",
    date_applied: "2026-02-01",
    next_action: null,
    next_action_date: null,
  },
];

function setup(props = {}) {
  const onOpen = vi.fn();
  const onSortChange = vi.fn();
  render(
    <ApplicationList
      applications={APPLICATIONS}
      onOpen={onOpen}
      sortBy="date_applied"
      sortDir="desc"
      onSortChange={onSortChange}
      {...props}
    />
  );
  return { onOpen, onSortChange };
}

describe("ApplicationList", () => {
  it("renders a row per application", () => {
    setup();
    expect(screen.getByText("Northwind")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing to list", () => {
    setup({ applications: [] });
    expect(screen.getByText(/no applications yet/i)).toBeInTheDocument();
  });

  it("opens the application when a row is clicked", async () => {
    const { onOpen } = setup();
    await userEvent.click(screen.getByText("Northwind"));
    expect(onOpen).toHaveBeenCalledWith(APPLICATIONS[0]);
  });

  it("opens the application from the keyboard", async () => {
    const { onOpen } = setup();
    const row = screen.getByText("Northwind").closest("tr");
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith(APPLICATIONS[0]);
  });

  it("has no per-row action buttons — actions moved to the detail screen", () => {
    setup();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("sorting", () => {
    it("sorts ascending when a new column is chosen", async () => {
      const { onSortChange } = setup();
      await userEvent.click(screen.getByText(/^Company/));
      expect(onSortChange).toHaveBeenCalledWith("company", "asc");
    });

    it("toggles direction when the active column is clicked again", async () => {
      const { onSortChange } = setup({ sortBy: "company", sortDir: "asc" });
      await userEvent.click(screen.getByText(/^Company/));
      expect(onSortChange).toHaveBeenCalledWith("company", "desc");
    });

    it("marks the active column with a direction arrow", () => {
      setup({ sortBy: "company", sortDir: "asc" });
      expect(screen.getByText(/Company ↑/)).toBeInTheDocument();
    });

    it("sorts the next action column by its date", async () => {
      const { onSortChange } = setup();
      await userEvent.click(screen.getByText(/^Next action/));
      expect(onSortChange).toHaveBeenCalledWith("next_action_date", "asc");
    });
  });

  describe("responsive columns", () => {
    // Which columns survive on a phone. The CSS hides .col-wide below 900px;
    // this asserts the right cells carry the class.
    const alwaysVisible = ["Company", "Status", "Next action", "Applied"];
    const wideOnly = ["Role", "Location", "Source", "Salary"];

    // Queried as column headers rather than by text: "Applied" is also a status
    // badge value, so a plain text query matches a body cell too.
    const header = (label) =>
      screen
        .getAllByRole("columnheader")
        .find((th) => th.textContent.startsWith(label));

    it.each(alwaysVisible)("keeps %s on narrow screens", (label) => {
      setup();
      expect(header(label)).not.toHaveClass("col-wide");
    });

    it.each(wideOnly)("hides %s on narrow screens", (label) => {
      setup();
      expect(header(label)).toHaveClass("col-wide");
    });
  });

  describe("cell formatting", () => {
    it("renders a salary range", () => {
      setup();
      expect(screen.getByText(/90,000–120,000 USD/)).toBeInTheDocument();
    });

    it("shows the next action with its due date", () => {
      setup();
      const row = screen.getByText("Northwind").closest("tr");
      expect(within(row).getByText("2026-03-15")).toBeInTheDocument();
    });

    it("falls back to a dash for empty values", () => {
      setup();
      const row = screen.getByText("Globex").closest("tr");
      expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
    });
  });
});
