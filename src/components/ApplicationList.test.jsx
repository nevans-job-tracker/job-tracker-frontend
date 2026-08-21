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

    // headerClick's logic is covered above, but each header hard-codes its own
    // column key and nothing else checks those strings. A wrong one reaches
    // the API as an unrecognised sort_by, so the header quietly stops working
    // rather than failing loudly. Every key here must stay in the backend's
    // sort_by pattern — see app/routers/applications.py.
    it.each([
      ["Company", "company"],
      ["Role", "role_title"],
      ["Location", "location"],
      ["Source", "source"],
      ["Status", "status"],
      ["Next action", "next_action_date"],
      ["Applied", "date_applied"],
    ])("the %s header sorts by %s", async (label, column) => {
      const { onSortChange } = setup();
      // By role, not text: "Applied" is also a status badge in the body.
      const th = screen
        .getAllByRole("columnheader")
        .find((h) => h.textContent.startsWith(label));
      await userEvent.click(th);
      expect(onSortChange).toHaveBeenCalledWith(column, "asc");
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
    it("renders a salary range in thousands, without the USD suffix", () => {
      setup();
      expect(screen.getByText("90K–120K")).toBeInTheDocument();
    });

    describe("salary formatting (KAN-36)", () => {
      const salary = (overrides) =>
        setup({
          applications: [
            { ...APPLICATIONS[0], id: 9, company: "Initech", ...overrides },
          ],
        });

      it("rounds to the nearest thousand", () => {
        salary({ salary_min: "106400.00", salary_max: "177300.00" });
        expect(screen.getByText("106K–177K")).toBeInTheDocument();
      });

      it("rounds a half up rather than truncating", () => {
        // 106500 -> 107K. Truncation would read 106K, understating the offer.
        salary({ salary_min: "106500.00", salary_max: "106500.00" });
        expect(screen.getByText("107K–107K")).toBeInTheDocument();
      });

      it("formats a lone bound the same way", () => {
        salary({ salary_min: "150000.00", salary_max: null });
        expect(screen.getByText("150K")).toBeInTheDocument();
      });

      it("formats a lone maximum the same way", () => {
        salary({ salary_min: null, salary_max: "150000.00" });
        expect(screen.getByText("150K")).toBeInTheDocument();
      });

      it("leaves a sub-1000 value unrounded", () => {
        // An hourly rate. Rounding this to thousands gives "0K", which is not
        // merely ugly but wrong.
        salary({ salary_min: "55.00", salary_max: "70.00" });
        expect(screen.getByText("55–70")).toBeInTheDocument();
      });

      it("keeps the suffix for a currency that is not USD", () => {
        // The field stays meaningful: dropping it unconditionally would show a
        // misleading bare number for a non-USD entry.
        salary({ salary_currency: "GBP" });
        expect(screen.getByText("90K–120K GBP")).toBeInTheDocument();
      });

      it("groups thousands in a very large figure", () => {
        salary({ salary_min: "1200000.00", salary_max: "1500000.00" });
        expect(screen.getByText("1,200K–1,500K")).toBeInTheDocument();
      });
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

    it("shows a dash rather than a blank cell for an undated application", () => {
      // A job tracked before applying has no date (KAN-31). Without the
      // fallback the Applied column renders empty, which reads as a rendering
      // fault rather than a deliberate absence.
      setup({
        applications: [
          { ...APPLICATIONS[0], id: 3, company: "Initech", date_applied: null,
            status: "interested" },
        ],
      });
      const row = screen.getByText("Initech").closest("tr");
      expect(within(row).getByText("Interested")).toBeInTheDocument();
      expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
    });
  });
});
