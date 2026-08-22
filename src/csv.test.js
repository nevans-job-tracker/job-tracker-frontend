import { describe, expect, it, vi, afterEach } from "vitest";
import { toCsv, csvFilename, downloadCsv, CSV_BOM } from "./csv.js";

const QUOTE = '"';
const APOSTROPHE = "'";

const application = (overrides = {}) => ({
  id: 1,
  company: "Acme Corp",
  role_title: "QA Engineer",
  job_link: null,
  source: "LinkedIn",
  location: "Austin TX",
  company_size: "mid_size",
  years_experience_min: 5,
  status: "phone_screen",
  salary_min: "106400.00",
  salary_max: "177300.00",
  salary_currency: "USD",
  date_applied: "2026-08-20",
  next_action: null,
  next_action_date: null,
  notes: null,
  job_description: null,
  archived_at: null,
  created_at: "2026-08-20T17:13:04",
  updated_at: "2026-08-20T17:13:04",
  contacts: [],
  ...overrides,
});

const rows = (csv) => csv.trimEnd().split("\r\n");
const header = (csv) => rows(csv)[0].split(",");
const cell = (csv, name, row = 1) => {
  const index = header(csv).indexOf(name);
  // A naive split is fine for the unquoted cases this helper is used on.
  return rows(csv)[row].split(",")[index];
};

describe("toCsv", () => {
  describe("values are written for a spreadsheet, not for the screen", () => {
    it("splits salary into two numeric columns Excel can sum", () => {
      // The list shows "106K–177K", which Excel would treat as text.
      const csv = toCsv([application()]);
      expect(cell(csv, "Salary min")).toBe("106400");
      expect(cell(csv, "Salary max")).toBe("177300");
      expect(csv).not.toContain("106K");
    });

    it("keeps dates in ISO so Excel parses them as dates", () => {
      expect(cell(toCsv([application()]), "Date applied")).toBe("2026-08-20");
    });

    it("replaces the T in a timestamp, which Excel leaves as text", () => {
      const csv = toCsv([application({ archived_at: "2026-08-21T10:36:44" })]);
      expect(cell(csv, "Archived at")).toBe("2026-08-21 10:36:44");
    });

    it("writes the readable status label, not the stored enum", () => {
      expect(cell(toCsv([application()]), "Status")).toBe("Phone Screen");
    });

    it("writes the company size band with its employee range", () => {
      const csv = toCsv([application({ company_size: "large" })]);
      expect(csv).toContain("Large (201–500 employees)");
    });

    it("leaves an empty cell for a null, not a dash or the word null", () => {
      // The list renders an em dash for absent values; a spreadsheet wants
      // nothing at all, or every count and average comes out wrong.
      const csv = toCsv([application({ source: null, years_experience_min: null })]);
      expect(cell(csv, "Source")).toBe("");
      expect(cell(csv, "Years experience (min)")).toBe("");
    });

    it("keeps zero years of experience as 0, not as blank", () => {
      // Entry level is a real answer and distinct from unstated (§2).
      const csv = toCsv([application({ years_experience_min: 0 })]);
      expect(cell(csv, "Years experience (min)")).toBe("0");
    });
  });

  describe("Excel will otherwise misread these", () => {
    it.each(["=1+1", "=cmd|calc", "+1", "-1+1", "@SUM(A1)"])(
      "neutralises %s so it is not run as a formula",
      (dangerous) => {
        const csv = toCsv([application({ notes: dangerous })]);
        expect(csv).toContain(APOSTROPHE + dangerous);
      }
    );

    it("does not maul a negative number into text", () => {
      // The guard keys off the value being a string, so a real number that
      // happens to start with a minus is left alone.
      const csv = toCsv([application({ years_experience_min: -1 })]);
      expect(cell(csv, "Years experience (min)")).toBe("-1");
    });

    it("quotes a field holding a comma", () => {
      const csv = toCsv([application({ location: "Austin, TX" })]);
      expect(csv).toContain(QUOTE + "Austin, TX" + QUOTE);
    });

    it("doubles the quotes inside a quoted field", () => {
      const notes = "they said " + QUOTE + "maybe" + QUOTE;
      const csv = toCsv([application({ notes })]);
      expect(csv).toContain(
        QUOTE + "they said " + QUOTE + QUOTE + "maybe" + QUOTE + QUOTE + QUOTE
      );
    });

    it("keeps an embedded newline inside one quoted field", () => {
      // Job descriptions are pasted whole, so this is the common case.
      const csv = toCsv([application({ job_description: "line one\nline two" })]);
      expect(csv).toContain(QUOTE + "line one\nline two" + QUOTE);
      // Still one record: a bare LF inside a field must not end the row.
      expect(rows(csv)).toHaveLength(2);
    });

    it("separates records with CRLF", () => {
      expect(toCsv([application()])).toContain("\r\n");
    });
  });

  describe("contacts flatten into numbered columns", () => {
    const withContacts = (...contacts) => application({ contacts });

    it("adds no contact columns when nothing has any", () => {
      const csv = toCsv([application()]);
      expect(header(csv).filter((h) => h.startsWith("Contact "))).toEqual([]);
    });

    it("names the columns per contact", () => {
      const csv = toCsv([withContacts({ name: "Dana Wu", title: "Recruiter" })]);
      expect(header(csv)).toContain("Contact 1 name");
      expect(cell(csv, "Contact 1 name")).toBe("Dana Wu");
      expect(cell(csv, "Contact 1 title")).toBe("Recruiter");
    });

    it("widens to the busiest application and pads the rest", () => {
      const csv = toCsv([
        withContacts({ name: "Ann" }, { name: "Bob" }),
        application({ id: 2, contacts: [] }),
      ]);
      expect(header(csv)).toContain("Contact 2 name");
      expect(cell(csv, "Contact 2 name", 1)).toBe("Bob");
      expect(cell(csv, "Contact 1 name", 2)).toBe("");
    });

    it("keeps one row per application", () => {
      // A row per contact would repeat the application, so any sum over
      // salary would double-count it.
      const csv = toCsv([withContacts({ name: "Ann" }, { name: "Bob" })]);
      expect(rows(csv)).toHaveLength(2);
    });

    it("tolerates an application with no contacts key at all", () => {
      const bare = { ...application() };
      delete bare.contacts;
      expect(() => toCsv([bare])).not.toThrow();
    });
  });

  it("emits a header row even with no applications", () => {
    expect(header(toCsv([]))[0]).toBe("ID");
  });
});

describe("the file itself", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is named for the day it was taken", () => {
    expect(csvFilename(new Date("2026-08-22T12:00:00Z"))).toBe(
      "job-tracker-2026-08-22.csv"
    );
  });

  it("starts with a BOM, or Excel mangles every en dash", () => {
    // COMPANY_SIZE_LABELS is full of them: "Mid-size (51–200 employees)".
    const captured = [];
    vi.stubGlobal(
      "Blob",
      class {
        constructor(parts) {
          captured.push(parts.join(""));
        }
      }
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => {},
    });

    downloadCsv("Company", "x.csv");
    expect(captured[0].startsWith(CSV_BOM)).toBe(true);
    expect(CSV_BOM).toBe("﻿");
  });

  it("hands the browser a named download and cleans up after itself", () => {
    vi.stubGlobal("Blob", class {});
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL });
    const click = vi.fn();
    const created = [];
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") {
        el.click = click;
        created.push(el);
      }
      return el;
    });

    downloadCsv("x", "job-tracker-2026-08-22.csv");

    expect(created[0].download).toBe("job-tracker-2026-08-22.csv");
    expect(click).toHaveBeenCalled();
    // Left behind, an anchor would pile up in the DOM on every export.
    expect(document.body.contains(created[0])).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    spy.mockRestore();
  });
});
