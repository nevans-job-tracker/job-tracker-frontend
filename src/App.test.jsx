import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App.jsx";
import { listApplications, getApplication } from "./api/client.js";

vi.mock("./api/client.js", () => ({
  listApplications: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  getApplication: vi.fn().mockResolvedValue({
    id: 7,
    company: "Northwind",
    role_title: "QA Engineer",
    status: "applied",
    date_applied: "2026-03-01",
    salary_currency: "USD",
    contacts: [],
  }),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

beforeEach(() => {
  // Call counts must not carry between tests: several assertions here are
  // about whether a request happened at all.
  vi.clearAllMocks();
});

describe("App routing", () => {
  it("shows the list at the root", async () => {
    renderAt("/");
    expect(
      await screen.findByRole("heading", { name: /job application tracker/i })
    ).toBeInTheDocument();
  });

  it("shows the new-entry screen", async () => {
    renderAt("/applications/new");
    expect(
      await screen.findByRole("heading", { name: "New application" })
    ).toBeInTheDocument();
  });

  it("shows an application's detail screen", async () => {
    renderAt("/applications/7");
    expect(await screen.findByText("Northwind — QA Engineer")).toBeInTheDocument();
    expect(getApplication).toHaveBeenCalledWith("7");
  });

  it("does not mistake /applications/new for an id", async () => {
    // "new" must be matched before ":id", or the new-entry screen would try to
    // load an application called "new".
    renderAt("/applications/new");
    await screen.findByRole("heading", { name: "New application" });
    expect(getApplication).not.toHaveBeenCalled();
  });

  it("redirects an unknown path back to the list", async () => {
    renderAt("/nonsense/path");
    expect(
      await screen.findByRole("heading", { name: /job application tracker/i })
    ).toBeInTheDocument();
    // The list fetch is debounced, so it lands after the heading renders.
    await waitFor(() => expect(listApplications).toHaveBeenCalled());
  });
});
