import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ListPage from "./ListPage.jsx";
import { listApplications } from "../api/client.js";

vi.mock("../api/client.js", () => ({ listApplications: vi.fn() }));

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

  describe("navigation", () => {
    it("opens an application when its row is clicked", async () => {
      setup();
      await userEvent.click(await screen.findByText("Company 01"));
      expect(await screen.findByText("Detail screen")).toBeInTheDocument();
    });

    it("goes to the new-entry screen from the add button", async () => {
      setup();
      await screen.findByText("Company 01");
      await userEvent.click(screen.getByRole("button", { name: /add application/i }));
      expect(await screen.findByText("New application")).toBeInTheDocument();
    });
  });
});
