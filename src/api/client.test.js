import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listApplications,
  listSources,
  getApplication,
  getStatusHistory,
  createApplication,
  updateApplication,
  archiveApplication,
  unarchiveApplication,
  createContact,
  updateContact,
  deleteContact,
} from "./client.js";

const BASE = "http://localhost:8000";

function mockResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    statusText: "Internal Server Error",
    json: async () => body,
  };
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(mockResponse());
});

const calledUrl = () => global.fetch.mock.calls[0][0];
const calledOptions = () => global.fetch.mock.calls[0][1];

describe("listSources", () => {
  it("requests the sources collection", async () => {
    await listSources();
    expect(calledUrl()).toBe(`${BASE}/applications/sources`);
  });

  it("returns the body", async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ body: { sources: ["Dice", "LinkedIn"] } })
    );
    expect(await listSources()).toEqual({ sources: ["Dice", "LinkedIn"] });
  });

  it("surfaces a failure rather than returning nothing", async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 500 }));
    await expect(listSources()).rejects.toThrow();
  });
});

describe("listApplications", () => {
  it("requests the collection with no query when given nothing", async () => {
    await listApplications();
    expect(calledUrl()).toBe(`${BASE}/applications`);
  });

  it("passes through the parameters it is given", async () => {
    await listApplications({ search: "Acme", status: "offer", limit: 50 });
    const url = new URL(calledUrl());
    expect(url.searchParams.get("search")).toBe("Acme");
    expect(url.searchParams.get("status")).toBe("offer");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("drops empty and undefined parameters", async () => {
    await listApplications({ search: "", status: undefined, sort_by: "company" });
    const url = new URL(calledUrl());
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.get("sort_by")).toBe("company");
  });

  it("keeps skip=0, which is meaningful rather than empty", async () => {
    await listApplications({ skip: 0, limit: 50 });
    expect(new URL(calledUrl()).searchParams.get("skip")).toBe("0");
  });

  it("returns the parsed body", async () => {
    global.fetch.mockResolvedValue(mockResponse({ body: { total: 3, items: [] } }));
    await expect(listApplications()).resolves.toEqual({ total: 3, items: [] });
  });
});

describe("single application requests", () => {
  it("fetches one by id", async () => {
    await getApplication(7);
    expect(calledUrl()).toBe(`${BASE}/applications/7`);
  });

  it("fetches status history from its own endpoint", async () => {
    // Its own request rather than embedded in the detail response: history is
    // kept off ApplicationOut so the CSV export does not load it per row.
    // Every page test mocks this module, so this is the only check on the URL.
    await getStatusHistory(7);
    expect(calledUrl()).toBe(`${BASE}/applications/7/history`);
  });

  it("posts a new application as JSON", async () => {
    await createApplication({ company: "Acme" });
    expect(calledUrl()).toBe(`${BASE}/applications`);
    expect(calledOptions().method).toBe("POST");
    expect(calledOptions().headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(calledOptions().body)).toEqual({ company: "Acme" });
  });

  it("patches an existing application", async () => {
    await updateApplication(7, { status: "offer" });
    expect(calledUrl()).toBe(`${BASE}/applications/7`);
    expect(calledOptions().method).toBe("PATCH");
  });

  it("archives by id", async () => {
    await archiveApplication(7);
    expect(calledUrl()).toBe(`${BASE}/applications/7/archive`);
    expect(calledOptions().method).toBe("POST");
  });

  it("unarchives by id", async () => {
    await unarchiveApplication(7);
    expect(calledUrl()).toBe(`${BASE}/applications/7/unarchive`);
    expect(calledOptions().method).toBe("POST");
  });

  it("exposes no way to delete an application", async () => {
    // Applications are archived, never deleted — REQUIREMENTS.md §4.1.
    const client = await import("./client.js");
    expect(client.deleteApplication).toBeUndefined();
  });
});

describe("contact requests", () => {
  it("nests creation under the application", async () => {
    await createContact(5, { name: "Dana Wu" });
    expect(calledUrl()).toBe(`${BASE}/applications/5/contacts`);
    expect(calledOptions().method).toBe("POST");
  });

  it("nests updates under the application", async () => {
    await updateContact(5, 11, { title: "QA Manager" });
    expect(calledUrl()).toBe(`${BASE}/applications/5/contacts/11`);
    expect(calledOptions().method).toBe("PATCH");
  });

  it("nests deletion under the application", async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 204 }));
    await deleteContact(5, 11);
    expect(calledUrl()).toBe(`${BASE}/applications/5/contacts/11`);
    expect(calledOptions().method).toBe("DELETE");
  });
});

describe("response handling", () => {
  it("returns null for 204 rather than trying to parse a body", async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 204 }));
    await expect(deleteContact(5, 11)).resolves.toBeNull();
  });

  it("throws with the API's detail message", async () => {
    global.fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 404, body: { detail: "Application not found" } })
    );
    await expect(getApplication(999)).rejects.toThrow("Application not found");
  });

  it("falls back to the status text when the body has no detail", async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));
    await expect(getApplication(1)).rejects.toThrow("Internal Server Error");
  });

  it("renders FastAPI's list-shaped validation errors readably", async () => {
    // Passed straight to Error() this would render as "[object Object]".
    global.fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 422,
        body: {
          detail: [
            { loc: ["body", "job_link"], msg: "Input should be a valid URL" },
          ],
        },
      })
    );
    await expect(getApplication(1)).rejects.toThrow(
      "job_link: Input should be a valid URL"
    );
  });

  it("joins multiple validation errors", async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 422,
        body: {
          detail: [
            { loc: ["body", "company"], msg: "Field required" },
            { loc: ["body", "date_applied"], msg: "Input should be a valid date" },
          ],
        },
      })
    );
    await expect(getApplication(1)).rejects.toThrow(
      "company: Field required; date_applied: Input should be a valid date"
    );
  });

  it("keeps a plain-string detail as written", async () => {
    // Rules the API enforces itself raise a readable sentence.
    global.fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 422,
        body: { detail: "Salary min cannot be greater than salary max." },
      })
    );
    await expect(getApplication(1)).rejects.toThrow(
      "Salary min cannot be greater than salary max."
    );
  });

  it("copes with a validation error that has no field location", async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 422,
        body: { detail: [{ msg: "Something was wrong" }] },
      })
    );
    await expect(getApplication(1)).rejects.toThrow("Something was wrong");
  });

  it("falls back to the status text when the body is not JSON", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(getApplication(1)).rejects.toThrow("Internal Server Error");
  });
});
