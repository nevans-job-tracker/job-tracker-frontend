import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ApplicationPage from "./ApplicationPage.jsx";
import {
  getApplication,
  createApplication,
  updateApplication,
  archiveApplication,
  unarchiveApplication,
} from "../api/client.js";

vi.mock("../api/client.js", () => ({
  getApplication: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  archiveApplication: vi.fn(),
  unarchiveApplication: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

const EXISTING = {
  id: 7,
  company: "Northwind",
  role_title: "QA Engineer",
  job_link: null,
  source: "referral",
  location: "Austin, TX",
  status: "interview",
  salary_min: null,
  salary_max: null,
  salary_currency: "USD",
  date_applied: "2026-03-01",
  notes: null,
  next_action: "Follow up",
  next_action_date: null,
  job_description: null,
  created_at: "2026-03-01T00:00:00",
  updated_at: "2026-03-01T00:00:00",
  contacts: [],
};

function setup(initialEntry) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<h1>All applications list</h1>} />
        <Route path="/applications/new" element={<ApplicationPage />} />
        <Route path="/applications/:id" element={<ApplicationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const fillRequired = async () => {
  await userEvent.type(screen.getByLabelText(/company/i), "Brand New Co");
  await userEvent.type(screen.getByLabelText(/role title/i), "QA Lead");
};

beforeEach(() => {
  vi.clearAllMocks();
  getApplication.mockResolvedValue(EXISTING);
});

describe("ApplicationPage — existing application", () => {
  it("loads and heads with the company and role", async () => {
    setup("/applications/7");
    expect(await screen.findByText("Northwind — QA Engineer")).toBeInTheDocument();
    expect(getApplication).toHaveBeenCalledWith("7");
  });

  it("populates the form", async () => {
    setup("/applications/7");
    await screen.findByText("Northwind — QA Engineer");
    expect(screen.getByLabelText(/company/i)).toHaveValue("Northwind");
    expect(screen.getByLabelText(/location/i)).toHaveValue("Austin, TX");
  });

  it("saves changes and confirms", async () => {
    updateApplication.mockResolvedValue({ ...EXISTING, status: "offer" });
    setup("/applications/7");
    await screen.findByText("Northwind — QA Engineer");

    await userEvent.selectOptions(screen.getByLabelText(/^status/i), "offer");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateApplication).toHaveBeenCalledWith(
        "7",
        expect.objectContaining({ status: "offer" })
      )
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("shows the contacts editor", async () => {
    setup("/applications/7");
    await screen.findByText("Northwind — QA Engineer");
    expect(screen.getByRole("heading", { name: "Contacts" })).toBeInTheDocument();
  });

  it("reports a load failure instead of rendering a broken page", async () => {
    getApplication.mockRejectedValue(new Error("Application not found"));
    setup("/applications/999");
    expect(await screen.findByText("Application not found")).toBeInTheDocument();
  });

  describe("archiving", () => {
    it("offers no delete action at all", async () => {
      // Applications are archived, never deleted — REQUIREMENTS.md §4.1.
      setup("/applications/7");
      await screen.findByText("Northwind — QA Engineer");
      expect(
        screen.queryByRole("button", { name: /delete/i })
      ).not.toBeInTheDocument();
    });

    it("archives and returns to the list", async () => {
      archiveApplication.mockResolvedValue({ ...EXISTING, archived_at: "2026-08-15T00:00:00" });
      setup("/applications/7");
      await screen.findByText("Northwind — QA Engineer");

      await userEvent.click(screen.getByRole("button", { name: /archive application/i }));

      await waitFor(() => expect(archiveApplication).toHaveBeenCalledWith("7"));
      expect(await screen.findByText("All applications list")).toBeInTheDocument();
    });

    it("does not prompt for confirmation", async () => {
      // The action is reversible in one click, so a prompt would be friction
      // guarding against a mistake that costs nothing to undo.
      const confirmSpy = vi.spyOn(window, "confirm");
      archiveApplication.mockResolvedValue(EXISTING);
      setup("/applications/7");
      await screen.findByText("Northwind — QA Engineer");

      await userEvent.click(screen.getByRole("button", { name: /archive application/i }));

      await waitFor(() => expect(archiveApplication).toHaveBeenCalled());
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it("surfaces a failure to archive", async () => {
      archiveApplication.mockRejectedValue(new Error("Application not found"));
      setup("/applications/7");
      await screen.findByText("Northwind — QA Engineer");

      await userEvent.click(screen.getByRole("button", { name: /archive application/i }));
      expect(await screen.findByText("Application not found")).toBeInTheDocument();
    });
  });

  describe("when already archived", () => {
    const ARCHIVED = { ...EXISTING, archived_at: "2026-08-01T00:00:00" };

    it("marks the record as archived", async () => {
      getApplication.mockResolvedValue(ARCHIVED);
      setup("/applications/7");
      expect(await screen.findByText("Archived")).toBeInTheDocument();
    });

    it("offers unarchive instead of archive", async () => {
      getApplication.mockResolvedValue(ARCHIVED);
      setup("/applications/7");
      await screen.findByText("Northwind — QA Engineer");

      expect(
        screen.getByRole("button", { name: /unarchive application/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^archive application$/i })
      ).not.toBeInTheDocument();
    });

    it("restores the record in place, without leaving the page", async () => {
      getApplication.mockResolvedValue(ARCHIVED);
      unarchiveApplication.mockResolvedValue({ ...EXISTING, archived_at: null });
      setup("/applications/7");
      await screen.findByText("Northwind — QA Engineer");

      await userEvent.click(
        screen.getByRole("button", { name: /unarchive application/i })
      );

      await waitFor(() => expect(unarchiveApplication).toHaveBeenCalledWith("7"));
      expect(await screen.findByRole("button", { name: /^archive application$/i })).toBeInTheDocument();
      expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    });
  });
});

describe("ApplicationPage — new application", () => {
  it("opens a blank form without fetching anything", async () => {
    setup("/applications/new");
    expect(await screen.findByText("New application")).toBeInTheDocument();
    expect(getApplication).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/company/i)).toHaveValue("");
  });

  it("hides the contacts editor until the record exists", async () => {
    setup("/applications/new");
    await screen.findByText("New application");
    expect(screen.queryByRole("heading", { name: "Contacts" })).not.toBeInTheDocument();
    expect(screen.getByText(/contacts can be added once/i)).toBeInTheDocument();
  });

  it("creates the application from the entered values", async () => {
    createApplication.mockResolvedValue({ ...EXISTING, id: 42, company: "Brand New Co" });
    setup("/applications/new");
    await screen.findByText("New application");

    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: /create application/i }));

    await waitFor(() =>
      expect(createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ company: "Brand New Co", role_title: "QA Lead" })
      )
    );
  });

  it("switches to the saved application without crashing", async () => {
    // Regression: the route gains an :id on the same mounted component, so
    // isNew flips to false while the record is still null. That combination
    // previously threw on application.company and blanked the page.
    const created = {
      ...EXISTING,
      id: 42,
      company: "Brand New Co",
      role_title: "QA Lead",
    };
    createApplication.mockResolvedValue(created);
    // The route change triggers a re-fetch by the new id, so the mock has to
    // answer for that id rather than returning the default fixture.
    getApplication.mockImplementation(async (id) =>
      String(id) === "42" ? created : EXISTING
    );
    setup("/applications/new");
    await screen.findByText("New application");

    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: /create application/i }));

    expect(await screen.findByText("Brand New Co — QA Lead")).toBeInTheDocument();
    // and the contacts editor is now available
    expect(screen.getByRole("heading", { name: "Contacts" })).toBeInTheDocument();
  });

  it("abandons the entry on cancel", async () => {
    setup("/applications/new");
    await screen.findByText("New application");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(await screen.findByText("All applications list")).toBeInTheDocument();
    expect(createApplication).not.toHaveBeenCalled();
  });
});

describe("ApplicationPage — back link", () => {
  it("returns to the list on a cold load, where there is no history", async () => {
    setup("/applications/7");
    await screen.findByText("Northwind — QA Engineer");

    await userEvent.click(screen.getByRole("link", { name: /all applications/i }));
    expect(await screen.findByText("All applications list")).toBeInTheDocument();
  });
});
