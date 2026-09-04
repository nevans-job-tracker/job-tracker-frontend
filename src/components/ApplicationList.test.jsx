import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import ApplicationList, { formatAge } from "./ApplicationList.jsx";
import { STATUS_LABELS } from "../labels.js";

const APPLICATIONS = [
  {
    id: 1,
    company: "Northwind",
    role_title: "QA Engineer",
    years_experience_min: 5,
    job_link: "https://northwind.example/jobs/1",
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
    years_experience_min: null,
    job_link: null,
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

/** Heading text with the sort arrow stripped, in table order. */
function headerNames() {
  return screen
    .getAllByRole("columnheader")
    .map((h) => h.textContent.replace(/[↑↓]/g, "").trim());
}

function setup(props = {}) {

  const onSortChange = vi.fn();
  render(
    <MemoryRouter>
      <ApplicationList
      applications={APPLICATIONS}
      sortBy="date_applied"
      sortDir="desc"
      onSortChange={onSortChange}
        {...props}
      />
    </MemoryRouter>
  );
  return { onSortChange };
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

  it("opens the application from the company name", async () => {
    setup();
    expect(screen.getByRole("link", { name: "Northwind" })).toHaveAttribute(
      "href",
      "/applications/1"
    );
  });

  it("opens it from the role title too", async () => {
    // Role is col-wide, so it cannot be the only way in — a phone would have
    // none. Company carries it as well. See KAN-60.
    setup();
    expect(screen.getByRole("link", { name: "QA Engineer" })).toHaveAttribute(
      "href",
      "/applications/1"
    );
  });

  it("is a real link, so it can be middle-clicked or opened in a new tab", () => {
    // Previously a div with tabIndex and a keydown handler, which none of that
    // works on.
    setup();
    const link = screen.getByRole("link", { name: "Northwind" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("record-link");
  });

  it("leaves the rest of the row inert", async () => {
    setup();
    const row = screen.getByText("Northwind").closest("tr");
    expect(row).not.toHaveAttribute("tabindex");
    expect(row).not.toHaveClass("row-clickable");
    // The date cell is not a way in.
    expect(within(row).queryByRole("link", { name: "2026-03-01" })).toBeNull();
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
      ["Type", "employment_type"],
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
    const wideOnly = ["Role", "Type", "Source", "Experience", "Link", "Pay"];

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
        salary({ salary_min: "106500.00", salary_max: "106400.00" });
        expect(screen.getByText("107K–106K")).toBeInTheDocument();
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
      // Scoped to the badge: since KAN-59 the cell also holds a select whose
      // selected option carries the same text.
      expect(
        within(row).getByText("Interested", { selector: ".badge" })
      ).toBeInTheDocument();
      expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
    });
  });
});

describe("the job posting link (KAN-45)", () => {
  const link = () =>
    screen.getByRole("link", {
      name: "Open the posting for Northwind in a new tab",
    });

  it("opens the posting in a new tab", () => {
    setup();
    expect(link()).toHaveAttribute("href", "https://northwind.example/jobs/1");
    expect(link()).toHaveAttribute("target", "_blank");
  });

  it("does not hand the opened page a handle on this one", () => {
    // Without noopener the posting can navigate the tab it was opened from.
    setup();
    expect(link()).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("names the company, since the glyph is the same on every row", () => {
    setup();
    expect(
      screen.queryByRole("link", {
        name: "Open the posting for Globex in a new tab",
      })
    ).not.toBeInTheDocument();
  });

  it("renders no link for an application without one", () => {
    // Counted by class rather than by role: since KAN-60 every row also has
    // Company and Role links, so a bare role count would mean nothing.
    setup();
    expect(document.querySelectorAll(".link-out")).toHaveLength(1);
  });

  it("renders no link for a value that is not http(s)", () => {
    // The column is still writable through the API, so a stored
    // "javascript:..." must not become a live anchor.
    setup({
      applications: [{ ...APPLICATIONS[0], job_link: "javascript:alert(1)" }],
    });
    expect(document.querySelector(".link-out")).toBeNull();
  });

  it("goes to the posting, not to the detail screen", async () => {
    // Since KAN-60 the row is inert, so this no longer needs a
    // stopPropagation guard — the two links simply point at different places.
    setup();
    expect(link()).toHaveAttribute("href", "https://northwind.example/jobs/1");
    expect(
      screen.getByRole("link", { name: "Northwind" })
    ).toHaveAttribute("href", "/applications/1");
  });
});

describe("salary on one line (KAN-46)", () => {
  it("marks the salary cell as unbreakable", () => {
    // jsdom does not lay out, so it cannot see the wrap itself — that was
    // measured in a real viewport. What is checkable here is the class the
    // nowrap rule hangs off, which is the part a refactor would drop
    // silently.
    setup();
    const cell = screen.getByText("90K–120K");
    expect(cell).toHaveClass("col-salary");
  });

  it("keeps the date cell unbreakable for the same reason", () => {
    setup();
    expect(screen.getByText("2026-03-01")).toHaveClass("col-date");
  });
});

describe("required experience (KAN-47)", () => {
  it("shows the stored minimum with a plus", () => {
    // The column stores a minimum, so "at least 5" is true whether the posting
    // said "5+" or "5-8 years". A bare 5 would read as exact.
    setup();
    expect(screen.getByText("5+")).toBeInTheDocument();
  });

  it("shows a dash when nothing was recorded", () => {
    setup({ applications: [APPLICATIONS[1]] });
    const row = screen.getByText("Globex").closest("tr");
    expect(row.cells[5]).toHaveTextContent("—");
  });

  it("calls zero Entry rather than 0+", () => {
    // §2: 0 is a real answer distinct from blank — an entry-level posting
    // states no minimum. "0+" would be true and say nothing.
    setup({ applications: [{ ...APPLICATIONS[0], years_experience_min: 0 }] });
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.queryByText("0+")).not.toBeInTheDocument();
  });

  it("sorts by the column the API actually accepts", async () => {
    // years_experience_min is already in the route's sort_by whitelist; a
    // typo here would 422 rather than fail visibly.
    const { onSortChange } = setup();
    await userEvent.click(screen.getByText(/^Experience/));
    expect(onSortChange).toHaveBeenCalledWith("years_experience_min", "asc");
  });

  it("toggles direction when already sorted by it", async () => {
    const { onSortChange } = setup({ sortBy: "years_experience_min", sortDir: "asc" });
    await userEvent.click(screen.getByText(/^Experience/));
    expect(onSortChange).toHaveBeenCalledWith("years_experience_min", "desc");
  });
});

describe("pay display (KAN-50)", () => {
  const pay = (fields) =>
    setup({ applications: [{ ...APPLICATIONS[0], ...fields }] });

  it("labels an hourly rate and does not scale it to thousands", () => {
    // Before pay_period, 86 rendered as a bare "86–86" that said nothing
    // about being a rate, and only the sub-1000 guard stopped it reading 0K.
    pay({ pay_period: "hourly", salary_min: "86.00", salary_max: "86.00" });
    expect(screen.getByText("86/hr")).toBeInTheDocument();
  });

  it("keeps an hourly range as a range", () => {
    pay({ pay_period: "hourly", salary_min: "85.00", salary_max: "95.00" });
    expect(screen.getByText("85–95/hr")).toBeInTheDocument();
  });

  it("shows a single annual figure once, not twice", () => {
    // A real row: 120000–120000 read as "120K–120K".
    pay({ pay_period: "annual", salary_min: "120000.00", salary_max: "120000.00" });
    expect(screen.getByText("120K")).toBeInTheDocument();
  });

  it("leaves an annual range alone", () => {
    pay({ pay_period: "annual", salary_min: "106400.00", salary_max: "177300.00" });
    expect(screen.getByText("106K–177K")).toBeInTheDocument();
  });

  it("still labels a non-USD currency", () => {
    pay({ pay_period: "hourly", salary_min: "70.00", salary_max: "70.00",
          salary_currency: "GBP" });
    expect(screen.getByText("70/hr GBP")).toBeInTheDocument();
  });

  it("calls the column Pay, since it holds two kinds of thing", () => {
    setup();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toContain("Pay");
    expect(headers).not.toContain("Salary");
  });
});

describe("employment type in the list (KAN-51)", () => {
  it("shows the readable label", () => {
    setup({ applications: [{ ...APPLICATIONS[0], employment_type: "contract_to_hire" }] });
    expect(screen.getByText("Contract-to-Hire")).toBeInTheDocument();
  });

  it("shows a dash when it was not recorded", () => {
    setup({ applications: [{ ...APPLICATIONS[0], employment_type: null }] });
    // Located by heading rather than by a fixed index: the column moved in
    // KAN-64 and a hardcoded position only says which cell was checked, not
    // which column it belonged to.
    const row = screen.getByText("Northwind").closest("tr");
    expect(row.cells[headerNames().indexOf("Type")]).toHaveTextContent("—");
  });

  it("no longer offers a Location column", () => {
    // Dropped to make room (KAN-51) — the search is effectively all-remote,
    // so it said "Remote" on nearly every row. Still stored and searchable.
    setup();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).not.toContain("Location");
  });
});

describe("changing a status from the list (KAN-59)", () => {
  const statusSelect = (company) =>
    screen.getByLabelText(`Status for ${company}`);

  it("offers every status, showing the current one", () => {
    setup();
    const select = statusSelect("Northwind");
    expect(select).toHaveValue("applied");
    expect([...select.options].map((o) => o.value)).toEqual(
      Object.keys(STATUS_LABELS)
    );
  });

  it("reports the change with the row it belongs to", async () => {
    const onStatusChange = vi.fn();
    setup({ onStatusChange });
    await userEvent.selectOptions(statusSelect("Northwind"), "posting_closed");
    expect(onStatusChange).toHaveBeenCalledWith(
      APPLICATIONS[0],
      "posting_closed"
    );
  });

  it("is not inside the record link", async () => {
    // KAN-60 made the row inert, so the select no longer needs a
    // stopPropagation guard. What must stay true is that it is not nested
    // within the link, which would make every change a navigation.
    setup({ onStatusChange: vi.fn() });
    const select = statusSelect("Northwind");
    expect(select.closest("a")).toBeNull();
  });

  it("names the row it belongs to, for assistive technology", () => {
    // Nine identical dropdowns otherwise read as one repeated control.
    setup();
    expect(statusSelect("Globex")).toBeInTheDocument();
  });

  it("carries its status colour rather than a default grey", () => {
    // §4.4 chose those pairs deliberately; a plain select would cost the list
    // its at-a-glance scan.
    setup();
    expect(statusSelect("Northwind")).toHaveClass("badge-applied");
    expect(statusSelect("Globex")).toHaveClass("badge-offer");
  });

  it("keeps the badge for narrow screens and the select for wide", () => {
    // The one cell whose content is responsive rather than its presence: a
    // mis-tap here changes data, which is why the phone does not get it.
    setup();
    const row = screen.getByText("Northwind").closest("tr");
    const cell = row.querySelector(".col-status");
    expect(cell.querySelector(".col-narrow .badge")).toBeInTheDocument();
    expect(cell.querySelector("select")).toHaveClass("col-wide");
  });
});

describe("column order (KAN-64)", () => {
  it("leads with identity, then the two controls", () => {
    setup();
    expect(headerNames().slice(0, 4)).toEqual([
      "Company",
      "Role",
      "Link",
      "Status",
    ]);
  });

  it("keeps every cell under its own heading", () => {
    // thead and tbody are two separate lists in the same file. If they drift
    // apart the table misaligns with no error anywhere — every value under
    // the wrong title, and nothing throws. This is the guard for that.
    setup();
    const headers = headerNames();
    const row = screen.getByText("Northwind").closest("tr");
    const under = (name) => row.cells[headers.indexOf(name)];

    expect(under("Company")).toHaveTextContent("Northwind");
    expect(under("Role")).toHaveTextContent("QA Engineer");
    expect(within(under("Link")).getByRole("link")).toHaveAttribute(
      "href",
      APPLICATIONS[0].job_link
    );
    expect(
      within(under("Status")).getByLabelText("Status for Northwind")
    ).toBeInTheDocument();
    expect(under("Source")).toHaveTextContent("LinkedIn");
    expect(under("Experience")).toHaveTextContent("5");
    expect(under("Applied")).toHaveTextContent("2026-03-01");
  });
});

describe("formatAge (KAN-68)", () => {
  const now = new Date(2026, 8, 4, 12, 0); // 2026-09-04 midday, local

  it.each([
    ["2026-09-04T09:15:00", "Today"],
    ["2026-09-03T23:59:00", "1d"],
    ["2026-08-28T10:00:00", "7d"],
    ["2026-08-23T10:00:00", "12d"],
    ["2026-08-20T10:00:00", "15d"],
  ])("%s reads as %s", (created, expected) => {
    expect(formatAge(created, now)).toBe(expected);
  });

  it("counts calendar days, not elapsed hours", () => {
    // Added at 23:59 last night is 1 day old, not 0 — twelve elapsed hours
    // would round to today and read as though it had just arrived.
    expect(formatAge("2026-09-03T23:59:00", now)).toBe("1d");
    expect(formatAge("2026-09-04T00:01:00", now)).toBe("Today");
  });

  it("says Today rather than 0d", () => {
    // "0d" reads as an absence rather than a value.
    expect(formatAge("2026-09-04T00:00:00", now)).not.toBe("0d");
  });

  it("never rolls days up into weeks or months", () => {
    // §4.4's rule for the timeline, same reason: only one of "2w" and "15d"
    // compares against its neighbours without thinking.
    for (const days of [7, 14, 30, 90]) {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      expect(formatAge(d.toISOString(), now)).toBe(`${days}d`);
    }
  });

  it.each([null, undefined, "", "not a date"])(
    "shows a dash rather than inventing an age for %s",
    (value) => {
      expect(formatAge(value, now)).toBe("—");
    }
  );

  it("does not produce a negative age for a clock-skewed future date", () => {
    expect(formatAge("2026-09-06T10:00:00", now)).toBe("Today");
  });
});

describe("the Added column (KAN-68)", () => {
  const header = () =>
    screen.getAllByRole("columnheader").find((h) => h.textContent.startsWith("Added"));

  it("shows how long ago each application was added", () => {
    const d = new Date();
    d.setDate(d.getDate() - 12);
    setup({
      applications: [{ ...APPLICATIONS[0], created_at: d.toISOString() }],
    });
    expect(screen.getByText("12d")).toBeInTheDocument();
  });

  it("carries the exact timestamp in a tooltip", () => {
    // The column answers "how old"; the precise moment is one hover away.
    setup({
      applications: [{ ...APPLICATIONS[0], created_at: "2026-08-23T16:01:48" }],
    });
    const cell = screen.getByText(/\d+d|Today/).closest("td");
    expect(cell).toHaveAttribute("title", "2026-08-23T16:01:48");
  });

  it("sorts by the column the API actually accepts", async () => {
    // created_at is already in the route's sort_by whitelist; a typo here
    // would 422 rather than fail visibly.
    const { onSortChange } = setup();
    await userEvent.click(header());
    expect(onSortChange).toHaveBeenCalledWith("created_at", "asc");
  });

  it("is desktop-only, so the phone budget is untouched", () => {
    setup();
    expect(header()).toHaveClass("col-wide");
  });

  it("sits immediately before Applied", () => {
    setup();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    const added = headers.findIndex((h) => h.startsWith("Added"));
    expect(headers[added + 1]).toMatch(/^Applied/);
  });
});
