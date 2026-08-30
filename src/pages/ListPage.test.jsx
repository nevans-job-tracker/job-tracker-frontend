import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ListPage from "./ListPage.jsx";
import {
  listApplications,
  listSources,
  updateApplication,
} from "../api/client.js";
import { downloadCsv } from "../csv.js";
import { STATUS_LABELS } from "../labels.js";

vi.mock("../api/client.js", () => ({
  listApplications: vi.fn(),
  listSources: vi.fn().mockResolvedValue({ sources: [] }),
  updateApplication: vi.fn().mockResolvedValue({}),
}));

// toCsv stays real, so these exercise the actual file the browser would get.
// Only the handover to the browser is stubbed — jsdom has no Blob download.
vi.mock("../csv.js", async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCsv: vi.fn(),
}));

function application(n, overrides = {}) {
  return {
    id: n,
    company: `Company ${String(n).padStart(2, "0")}`,
    role_title: "QA Engineer",
    location: "Remote",
    source: "LinkedIn",
    status: "applied",
    salary_min: null,
    salary_max: null,
    salary_currency: "USD",
    date_applied: "2026-03-01",
    next_action: null,
    next_action_date: null,
    ...overrides,
  };
}

/** Reports the current URL so assertions can check what was written to it. */
function LocationSpy({ onChange }) {
  const location = useLocation();
  onChange(location.pathname + location.search);
  return null;
}

function setup({ initialEntry = "/", total = 2, items } = {}) {
  const seen = { url: null };
  listApplications.mockResolvedValue({
    total,
    items: items ?? [application(1), application(2)],
  });

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationSpy onChange={(url) => (seen.url = url)} />
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/applications/new" element={<h1>New application</h1>} />
        <Route path="/applications/:id" element={<h1>Detail screen</h1>} />
      </Routes>
    </MemoryRouter>
  );
  return seen;
}

const lastQuery = () =>
  listApplications.mock.calls[listApplications.mock.calls.length - 1][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ListPage", () => {
  it("loads and lists applications", async () => {
    setup();
    expect(await screen.findByText("Company 01")).toBeInTheDocument();
  });

  it("requests the first page with the default sort", async () => {
    setup();
    await waitFor(() => expect(listApplications).toHaveBeenCalled());
    expect(lastQuery()).toMatchObject({
      skip: 0,
      limit: 50,
      sort_by: "date_applied",
      sort_dir: "desc",
      search: "",
      status: "",
      show: "active",
    });
  });

  describe("source filter (KAN-56)", () => {
    const sourceSelect = () => screen.getByLabelText(/filter by source/i);

    it("offers the options the API reports", async () => {
      listSources.mockResolvedValueOnce({ sources: ["Dice", "LinkedIn"] });
      setup();
      await screen.findByText("Company 01");
      await waitFor(() =>
        expect([...sourceSelect().options].map((o) => o.value)).toEqual([
          "",
          "Dice",
          "LinkedIn",
        ])
      );
    });

    it("sends no source by default", async () => {
      // The client drops empty values when it builds the query string, so an
      // empty source never reaches the API. This asserts the argument rather
      // than the URL because listApplications is mocked here.
      setup();
      await screen.findByText("Company 01");
      expect(lastQuery().source).toBe("");
    });

    it("asks the API for the chosen source", async () => {
      listSources.mockResolvedValueOnce({ sources: ["Dice", "LinkedIn"] });
      setup();
      await screen.findByText("Company 01");
      await waitFor(() => expect(sourceSelect().options).toHaveLength(3));
      await userEvent.selectOptions(sourceSelect(), "Dice");
      await waitFor(() => expect(lastQuery()).toMatchObject({ source: "Dice" }));
    });

    it("puts the choice in the URL", async () => {
      listSources.mockResolvedValueOnce({ sources: ["Dice"] });
      const seen = setup();
      await screen.findByText("Company 01");
      await waitFor(() => expect(sourceSelect().options).toHaveLength(2));
      await userEvent.selectOptions(sourceSelect(), "Dice");
      await waitFor(() => expect(seen.url).toBe("/?source=Dice"));
    });

    it("reads the choice back out of the URL", async () => {
      listSources.mockResolvedValueOnce({ sources: ["Dice"] });
      setup({ initialEntry: "/?source=Dice" });
      await screen.findByText("Company 01");
      await waitFor(() => expect(sourceSelect()).toHaveValue("Dice"));
      expect(lastQuery()).toMatchObject({ source: "Dice" });
    });

    it("keeps its options when the list narrows to one source", async () => {
      // Fetched once on mount rather than per filter change. Recomputing them
      // from the visible rows would leave only the chosen source selectable,
      // with no way back to All.
      listSources.mockResolvedValueOnce({ sources: ["Dice", "LinkedIn"] });
      setup();
      await screen.findByText("Company 01");
      await waitFor(() => expect(sourceSelect().options).toHaveLength(3));
      await userEvent.selectOptions(sourceSelect(), "Dice");
      await waitFor(() => expect(lastQuery()).toMatchObject({ source: "Dice" }));
      expect(sourceSelect().options).toHaveLength(3);
    });

    it("carries the source into the CSV export", async () => {
      listSources.mockResolvedValueOnce({ sources: ["Dice"] });
      setup();
      await screen.findByText("Company 01");
      await waitFor(() => expect(sourceSelect().options).toHaveLength(2));
      await userEvent.selectOptions(sourceSelect(), "Dice");
      await waitFor(() => expect(lastQuery()).toMatchObject({ source: "Dice" }));
      await userEvent.click(screen.getByRole("button", { name: /export csv/i }));
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ source: "Dice", include_contacts: true })
      );
    });

    it("still renders the page when the options cannot be fetched", async () => {
      // Losing the options costs the filter its choices, not the list.
      listSources.mockRejectedValueOnce(new Error("offline"));
      setup();
      expect(await screen.findByText("Company 01")).toBeInTheDocument();
      expect(sourceSelect().options).toHaveLength(1);
    });
  });

  describe("archive filter", () => {
    const showSelect = () => screen.getByLabelText(/show archived/i);

    it("defaults to active, so archived records are hidden", async () => {
      setup();
      await screen.findByText("Company 01");
      expect(showSelect()).toHaveValue("active");
      expect(lastQuery()).toMatchObject({ show: "active" });
    });

    it("requests archived records when asked", async () => {
      setup();
      await screen.findByText("Company 01");
      await userEvent.selectOptions(showSelect(), "archived");
      await waitFor(() => expect(lastQuery()).toMatchObject({ show: "archived" }));
    });

    it("puts the choice in the URL", async () => {
      const seen = setup();
      await screen.findByText("Company 01");
      await userEvent.selectOptions(showSelect(), "all");
      await waitFor(() => expect(seen.url).toBe("/?show=all"));
    });

    it("reads the choice back out of the URL", async () => {
      setup({ initialEntry: "/?show=archived" });
      await waitFor(() => expect(lastQuery()).toMatchObject({ show: "archived" }));
      expect(showSelect()).toHaveValue("archived");
    });

    it("applies alongside the status filter", async () => {
      // Archive state and status are independent axes; both apply at once.
      const seen = setup({ initialEntry: "/?status=rejected" });
      await screen.findByText("Company 01");
      await userEvent.selectOptions(showSelect(), "archived");

      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ status: "rejected", show: "archived" })
      );
      expect(seen.url).toBe("/?status=rejected&show=archived");
    });

    it("omits the default from the URL", async () => {
      const seen = setup({ initialEntry: "/?show=archived" });
      await screen.findByText("Company 01");
      await userEvent.selectOptions(showSelect(), "active");
      await waitFor(() => expect(seen.url).toBe("/"));
    });
  });

  it("surfaces a failure to load", async () => {
    listApplications.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <MemoryRouter>
        <ListPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });

  describe("URL state", () => {
    it("reads search, filter and sort out of the URL on load", async () => {
      setup({ initialEntry: "/?search=Acme&status=offer&sort_by=company&sort_dir=asc" });
      await waitFor(() => expect(listApplications).toHaveBeenCalled());
      expect(lastQuery()).toMatchObject({
        search: "Acme",
        status: "offer",
        sort_by: "company",
        sort_dir: "asc",
      });
    });

    it("restores the controls from the URL", async () => {
      setup({ initialEntry: "/?search=Acme&status=offer" });
      expect(await screen.findByDisplayValue("Acme")).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toHaveValue("offer");
    });

    it("writes typing into the URL", async () => {
      const seen = setup();
      await screen.findByText("Company 01");
      await userEvent.type(screen.getByPlaceholderText(/search/i), "Acme");
      await waitFor(() => expect(seen.url).toBe("/?search=Acme"));
    });

    it("writes the status filter into the URL", async () => {
      const seen = setup();
      await screen.findByText("Company 01");
      await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), "offer");
      await waitFor(() => expect(seen.url).toBe("/?status=offer"));
    });

    it("writes sorting into the URL", async () => {
      const seen = setup();
      await screen.findByText("Company 01");
      // By column header, not text: "Company" also prefixes every cell value.
      const header = screen
        .getAllByRole("columnheader")
        .find((th) => th.textContent.startsWith("Company"));
      await userEvent.click(header);
      await waitFor(() =>
        expect(seen.url).toBe("/?sort_by=company&sort_dir=asc")
      );
    });

    it("omits values that are already the default", async () => {
      // An unfiltered list should be a bare "/", not a URL full of defaults.
      const seen = setup({ initialEntry: "/?status=offer" });
      await screen.findByText("Company 01");
      await userEvent.selectOptions(screen.getByLabelText(/filter by status/i), "");
      await waitFor(() => expect(seen.url).toBe("/"));
    });
  });

  describe("pagination", () => {
    const page = (start) =>
      Array.from({ length: 50 }, (_, i) => application(start + i));

    it("shows the loaded count against the true total while more remain", async () => {
      setup({ total: 120, items: page(1) });
      expect(
        await screen.findByText("Showing 50 of 120 applications")
      ).toBeInTheDocument();
    });

    it("offers a load-more control with the remainder", async () => {
      setup({ total: 120, items: page(1) });
      expect(
        await screen.findByRole("button", { name: /load more \(70 remaining\)/i })
      ).toBeInTheDocument();
    });

    it("appends the next page instead of replacing", async () => {
      setup({ total: 120, items: page(1) });
      await screen.findByText("Company 01");

      listApplications.mockResolvedValue({ total: 120, items: page(51) });
      await userEvent.click(screen.getByRole("button", { name: /load more/i }));

      await waitFor(() =>
        expect(screen.getByText("Showing 100 of 120 applications")).toBeInTheDocument()
      );
      // first page still present, second page added
      expect(screen.getByText("Company 01")).toBeInTheDocument();
      expect(screen.getByText("Company 51")).toBeInTheDocument();
    });

    it("asks for the next page by offset", async () => {
      setup({ total: 120, items: page(1) });
      await screen.findByText("Company 01");

      // Must return the *second* page: without this the first page is appended
      // to itself, and every row id collides on React's key.
      listApplications.mockResolvedValue({ total: 120, items: page(51) });
      await userEvent.click(screen.getByRole("button", { name: /load more/i }));

      await waitFor(() => expect(lastQuery()).toMatchObject({ skip: 50, limit: 50 }));
    });

    it("hides the control once everything is loaded", async () => {
      setup({ total: 2 });
      await screen.findByText("Company 01");
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
      expect(screen.getByText("2 applications")).toBeInTheDocument();
    });
  });

  describe("status filter labels", () => {
    // Same guard as ApplicationForm — see KAN-34.
    it.each(Object.entries(STATUS_LABELS))(
      "offers %s as %s",
      async (value, label) => {
        setup();
        const option = await screen.findByRole("option", { name: label });
        expect(option).toHaveValue(value);
      }
    );

    it("labels the unfiltered option All Statuses", async () => {
      setup();
      expect(await screen.findByRole("option", { name: "All Statuses" }))
        .toHaveValue("");
    });
  });

  describe("export (KAN-39)", () => {
    const exportButton = () => screen.getByRole("button", { name: /export csv/i });

    it("offers an Export control", async () => {
      setup();
      await screen.findByText("Company 01");
      expect(exportButton()).toBeInTheDocument();
    });

    it("is disabled when the filters match nothing", async () => {
      // A file of nothing but headers is a puzzle, not a deliverable.
      setup({ total: 0, items: [] });
      await waitFor(() => expect(listApplications).toHaveBeenCalled());
      expect(exportButton()).toBeDisabled();
    });

    it("asks for every matching row, not the page on screen", async () => {
      // The list paginates at 50 (§4.3). Exporting 50 of 120 without saying so
      // is the same silent truncation that story exists to have fixed.
      const page = Array.from({ length: 50 }, (_, i) => application(i + 1));
      setup({ total: 120, items: page });
      await screen.findByText("Company 01");

      await userEvent.click(exportButton());
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({
          skip: 0,
          limit: 120,
          include_contacts: true,
        })
      );
    });

    it("carries the current filters into the export", async () => {
      setup({ initialEntry: "/?search=Acme&status=offer&show=archived" });
      await screen.findByText("Company 01");

      await userEvent.click(exportButton());
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({
          search: "Acme",
          status: "offer",
          show: "archived",
          include_contacts: true,
        })
      );
    });

    it("hands the browser a dated file containing the rows", async () => {
      setup();
      await screen.findByText("Company 01");
      await userEvent.click(exportButton());

      await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
      const [text, filename] = downloadCsv.mock.calls[0];
      expect(filename).toMatch(/^job-tracker-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(text).toContain("Company 01");
      expect(text.split("\r\n")[0]).toContain("Job description");
    });

    it("surfaces a failure instead of downloading a broken file", async () => {
      setup();
      await screen.findByText("Company 01");
      listApplications.mockRejectedValueOnce(new Error("Failed to fetch"));

      await userEvent.click(exportButton());
      expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
      expect(downloadCsv).not.toHaveBeenCalled();
    });
  });

  describe("navigation", () => {
    it("opens an application from the company link", async () => {
      // The whole row used to be clickable. Since KAN-60 only Company and
      // Role are, which is what lets a per-row control exist at all.
      setup();
      await userEvent.click(await screen.findByText("Company 01"));
      expect(await screen.findByText("Detail screen")).toBeInTheDocument();
    });

    it("does not open one from the rest of the row", async () => {
      setup();
      await screen.findByText("Company 01");
      const row = screen.getAllByRole("row")[1];
      // The Applied cell is the last one and carries nothing interactive.
      await userEvent.click(row.cells[row.cells.length - 1]);
      expect(screen.queryByText("Detail screen")).not.toBeInTheDocument();
    });

    it("goes to the new-entry screen from the add button", async () => {
      setup();
      await screen.findByText("Company 01");
      await userEvent.click(screen.getByRole("button", { name: /add application/i }));
      expect(await screen.findByText("New application")).toBeInTheDocument();
    });
  });
});

describe("changing a status from the list (KAN-59)", () => {
  const firstStatus = () =>
    screen.getByLabelText(`Status for ${screen.getAllByRole("row")[1].cells[0].textContent}`);

  it("saves the change", async () => {
    setup();
    await screen.findByText("Company 01");
    await userEvent.selectOptions(firstStatus(), "posting_closed");
    await waitFor(() =>
      expect(updateApplication).toHaveBeenCalledWith(1, { status: "posting_closed" })
    );
  });

  it("shows the new value immediately, without refetching the list", async () => {
    // Optimistic: the control has to respond at once, and a refetch would
    // also re-sort the row out from under the cursor.
    setup();
    await screen.findByText("Company 01");
    const before = listApplications.mock.calls.length;

    await userEvent.selectOptions(firstStatus(), "offer");
    expect(firstStatus()).toHaveValue("offer");
    expect(listApplications.mock.calls.length).toBe(before);
  });

  it("reverts and explains when the save fails", async () => {
    // A select left showing a value the server rejected is a lie, and
    // whatever the user does next would be based on it.
    updateApplication.mockRejectedValueOnce(new Error("Application not found"));
    setup();
    await screen.findByText("Company 01");
    const original = firstStatus().value;

    await userEvent.selectOptions(firstStatus(), "ghosted");
    expect(await screen.findByText(/application not found/i)).toBeInTheDocument();
    await waitFor(() => expect(firstStatus()).toHaveValue(original));
  });

  it("does nothing when the value has not actually changed", async () => {
    setup();
    await screen.findByText("Company 01");
    const current = firstStatus().value;
    await userEvent.selectOptions(firstStatus(), current);
    expect(updateApplication).not.toHaveBeenCalled();
  });

  it("changes only the row it was asked about", async () => {
    setup();
    await screen.findByText("Company 01");
    const second = screen.getByLabelText("Status for Company 02");
    const before = second.value;

    await userEvent.selectOptions(firstStatus(), "withdrawn");
    expect(second).toHaveValue(before);
  });

  it("does not navigate to the detail screen", async () => {
    const seen = setup();
    await screen.findByText("Company 01");
    await userEvent.selectOptions(firstStatus(), "rejected");
    await waitFor(() => expect(updateApplication).toHaveBeenCalled());
    expect(seen.url).toBe("/");
  });
});
