import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationForm from "./ApplicationForm.jsx";
import { STATUS_LABELS } from "./StatusBadge.jsx";
import { COMPANY_SIZE_LABELS } from "./companySize.js";

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(<ApplicationForm onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { onSubmit, onCancel };
}

const submit = () => userEvent.click(screen.getByRole("button", { name: /save|create/i }));

describe("ApplicationForm", () => {
  it("submits the values that were typed", async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
    await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ company: "Acme Corp", role_title: "QA Engineer" })
    );
  });

  it("sends null rather than empty strings for untouched optional fields", async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
    await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
    await submit();

    const payload = onSubmit.mock.calls[0][0];
    for (const field of [
      "job_link",
      "source",
      "location",
      "next_action",
      "next_action_date",
      "notes",
      "job_description",
      "company_size",
      "years_experience_min",
    ]) {
      expect(payload[field], `${field} should be null`).toBeNull();
    }
    expect(payload.salary_min).toBeNull();
    expect(payload.salary_max).toBeNull();
  });

  it("converts salary inputs to numbers", async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
    await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
    await userEvent.type(screen.getByLabelText(/salary min/i), "90000");
    await submit();

    expect(onSubmit.mock.calls[0][0].salary_min).toBe(90000);
  });

  it("defaults date applied to today and status to applied", () => {
    setup();
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText(/date applied/i)).toHaveValue(today);
    expect(screen.getByLabelText(/^status/i)).toHaveValue("applied");
  });

  describe("when editing an existing application", () => {
    const existing = {
      id: 7,
      company: "Northwind",
      role_title: "QA Engineer",
      location: "Austin, TX",
      status: "interview",
      date_applied: "2026-03-01",
      next_action: "Follow up",
      salary_min: null,
      created_at: "2026-03-01T00:00:00",
      updated_at: "2026-03-02T00:00:00",
      contacts: [{ id: 1, name: "Dana Wu" }],
    };

    it("populates the fields", () => {
      setup({ initial: existing });
      expect(screen.getByLabelText(/^company \*$/i)).toHaveValue("Northwind");
      expect(screen.getByLabelText(/^status/i)).toHaveValue("interview");
      expect(screen.getByLabelText(/next action$/i)).toHaveValue("Follow up");
    });

    it("keeps server-managed fields out of the payload", async () => {
      // id/created_at/updated_at/contacts belong to the server; sending them
      // back would be noise at best.
      const { onSubmit } = setup({ initial: existing });
      await submit();

      const payload = onSubmit.mock.calls[0][0];
      for (const field of ["id", "created_at", "updated_at", "contacts"]) {
        expect(payload).not.toHaveProperty(field);
      }
    });

    it("leaves untouched fields unchanged", async () => {
      const { onSubmit } = setup({ initial: existing });
      await userEvent.clear(screen.getByLabelText(/^company \*$/i));
      await userEvent.type(screen.getByLabelText(/^company \*$/i), "Northwind Traders");
      await submit();

      const payload = onSubmit.mock.calls[0][0];
      expect(payload.company).toBe("Northwind Traders");
      expect(payload.location).toBe("Austin, TX");
      expect(payload.status).toBe("interview");
    });
  });

  describe("field wiring", () => {
    // update() is covered by the tests above, but every input hard-codes its
    // own field name and nothing else checks those strings. A mistyped key
    // writes to a property the payload never reads, so the value is silently
    // dropped on save — the form still looks like it worked.
    //
    // fireEvent.change rather than userEvent.type so date and number inputs
    // take a value the same way text ones do; what's under test is the wiring,
    // not the typing.
    const fill = (label, value) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });

    it.each([
      [/job link/i, "job_link", "https://example.com/job", "https://example.com/job"],
      [/^source$/i, "source", "LinkedIn", "LinkedIn"],
      [/company size/i, "company_size", "mid_size", "mid_size"],
      [/years experience/i, "years_experience_min", "5", 5],
      [/^location$/i, "location", "Austin, TX", "Austin, TX"],
      [/salary max/i, "salary_max", "120000", 120000],
      [/^next action$/i, "next_action", "Follow up", "Follow up"],
      [/next action date/i, "next_action_date", "2026-09-01", "2026-09-01"],
      [/^notes$/i, "notes", "Spoke to the recruiter", "Spoke to the recruiter"],
      [/job description/i, "job_description", "Pasted posting", "Pasted posting"],
    ])("%s is submitted as %s", async (label, key, entered, expected) => {
      const { onSubmit } = setup();
      fill(/^company \*$/i, "Acme Corp");
      fill(/role title/i, "QA Engineer");
      fill(label, entered);
      await submit();

      expect(onSubmit.mock.calls[0][0][key]).toEqual(expected);
    });
  });

  describe("tracking a job before applying (KAN-31)", () => {
    // The form always sends a status, so if the select did not follow the date
    // it would read "Applied" while the record being created has no date to
    // apply on. See the matching rule on ApplicationCreate in schemas.py.
    const dateField = () => screen.getByLabelText(/date applied/i);
    const statusField = () => screen.getByLabelText(/^status/i);

    it("no longer requires a date applied", () => {
      setup();
      expect(dateField()).not.toBeRequired();
    });

    it("shows Interested once the date is cleared", async () => {
      setup();
      expect(statusField()).toHaveValue("applied");
      await userEvent.clear(dateField());
      expect(statusField()).toHaveValue("interested");
    });

    it("goes back to Applied when a date is entered again", async () => {
      setup();
      await userEvent.clear(dateField());
      fireEvent.change(dateField(), { target: { value: "2026-08-21" } });
      expect(statusField()).toHaveValue("applied");
    });

    it("stops following once the user picks a status", async () => {
      // Interested-with-a-date is legitimate; the form must not argue.
      setup();
      await userEvent.selectOptions(statusField(), "interview");
      await userEvent.clear(dateField());
      expect(statusField()).toHaveValue("interview");
    });

    it("submits a null date rather than an empty string", async () => {
      const { onSubmit } = setup();
      await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
      await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
      await userEvent.clear(dateField());
      await submit();

      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        date_applied: null,
        status: "interested",
      });
    });

    it("leaves an existing record's date empty rather than filling today", () => {
      // Today is a default for a *new* record. Falling back to it here would
      // stamp a date the user never entered onto the next save.
      setup({ initial: { company: "Northwind", date_applied: null } });
      expect(dateField()).toHaveValue("");
    });

    it("does not rewrite the status of an existing undated record", () => {
      setup({ initial: { company: "Northwind", date_applied: null, status: "ghosted" } });
      expect(statusField()).toHaveValue("ghosted");
    });

    it("does not warn about a future date when there is no date", async () => {
      setup();
      await userEvent.clear(dateField());
      expect(screen.queryByText(/date is in the future/i)).not.toBeInTheDocument();
    });
  });

  it("has no currency field to mistype into", () => {
    // It was free text, which is how "A$" reached a Remote (United States)
    // role and then the list. Every job in this search pays in USD, so the
    // input could only ever be a way to get it wrong.
    setup();
    expect(screen.queryByLabelText(/currency/i)).not.toBeInTheDocument();
  });

  it("does not send a currency, so the API default stands", async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
    await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
    await submit();
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("salary_currency");
  });

  describe("company size (KAN-35)", () => {
    const sizeSelect = () => screen.getByLabelText(/company size/i);

    // Same guard as the status dropdown: the labels are string literals that
    // nothing else checks, and these carry the employee ranges that make the
    // band names mean anything. Written from the start rather than after a
    // KAN-34-style cleanup.
    it.each(Object.entries(COMPANY_SIZE_LABELS))(
      "offers %s as %s",
      (value, label) => {
        setup();
        expect(screen.getByRole("option", { name: label })).toHaveValue(value);
      }
    );

    it("labels every band with its employee range", () => {
      // "Large" means nothing without "201-500", and choosing correctly is the
      // whole point of a controlled list. Every label must carry a count.
      setup();
      for (const [value, label] of Object.entries(COMPANY_SIZE_LABELS)) {
        expect(label, `${value} must state a headcount`).toMatch(
          /\d[\d–+\s-]*employees/
        );
      }
      expect(screen.getByRole("option", { name: /^Large/ })).toHaveAccessibleName(
        "Large (201–500 employees)"
      );
    });

    it("offers blank as a real answer rather than a prompt", () => {
      setup();
      expect(screen.getByRole("option", { name: "Not stated" })).toHaveValue("");
      expect(sizeSelect()).toHaveValue("");
    });

    it("keeps a saved band selected", () => {
      setup({ initial: { company: "Northwind", company_size: "very_large" } });
      expect(sizeSelect()).toHaveValue("very_large");
    });

    it("lists the bands smallest to largest", () => {
      // The order is not cosmetic: it matches the enum on the backend, which
      // is what makes sorting by this column mean band order on MariaDB.
      setup();
      const values = [...sizeSelect().options].map((o) => o.value).filter(Boolean);
      expect(values).toEqual([
        "seed",
        "early",
        "mid_size",
        "large",
        "very_large",
        "massive",
      ]);
    });
  });

  describe("years experience required (KAN-32)", () => {
    const yearsField = () => screen.getByLabelText(/years experience/i);

    it("submits zero as a real answer, not as absent", () => {
      // An entry-level posting states no minimum, which is not the same as not
      // stating one — blankToNull would collapse the two.
      const { onSubmit } = setup();
      fireEvent.change(screen.getByLabelText(/^company \*$/i), {
        target: { value: "Acme Corp" },
      });
      fireEvent.change(screen.getByLabelText(/role title/i), {
        target: { value: "QA Engineer" },
      });
      fireEvent.change(yearsField(), { target: { value: "0" } });
      return submit().then(() => {
        expect(onSubmit.mock.calls[0][0].years_experience_min).toBe(0);
      });
    });

    it("refuses a negative minimum at the input", () => {
      setup();
      expect(yearsField()).toHaveAttribute("min", "0");
    });

    it("keeps a saved value without reading as an unsaved edit", () => {
      // The server returns a number and the input holds a string; comparing
      // them literally would leave the form permanently dirty after a save.
      const onDirtyChange = vi.fn();
      render(
        <ApplicationForm
          initial={{ company: "Northwind", years_experience_min: 5 }}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          onDirtyChange={onDirtyChange}
        />
      );
      expect(screen.getByLabelText(/years experience/i)).toHaveValue(5);
      expect(onDirtyChange).toHaveBeenCalledWith(false);
      expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    });
  });

  // Guards the fix from KAN-34. Three places used to render a status name and
  // only the badge used the shared map; the other two formatted their own with
  // replace("_", " "), which is where the lowercase came from. If someone
  // reintroduces local formatting, these fail.
  it.each(Object.entries(STATUS_LABELS))(
    "the status select offers %s as %s",
    (value, label) => {
      setup();
      const option = screen.getByRole("option", { name: label });
      expect(option).toHaveValue(value);
    }
  );

  it("surfaces a failure from the submit handler", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Company already tracked"));
    render(<ApplicationForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
    await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
    await submit();

    expect(await screen.findByText("Company already tracked")).toBeInTheDocument();
  });

  describe("future date applied", () => {
    // Decided: warn, don't reject — a future date is usually a mistyped year,
    // but logging an application about to be submitted is legitimate.
    const future = "2099-01-01";
    const warning = /date is in the future/i;

    it("warns when the date is in the future", async () => {
      setup();
      const field = screen.getByLabelText(/date applied/i);
      await userEvent.clear(field);
      await userEvent.type(field, future);

      expect(screen.getByText(warning)).toBeInTheDocument();
    });

    it("does not warn for today", () => {
      setup();
      expect(screen.queryByText(warning)).not.toBeInTheDocument();
    });

    it("does not warn for a past date", async () => {
      setup({ initial: { date_applied: "2020-01-01" } });
      expect(screen.queryByText(warning)).not.toBeInTheDocument();
    });

    it("still allows the record to be saved", async () => {
      const { onSubmit } = setup();
      await userEvent.type(screen.getByLabelText(/^company \*$/i), "Acme Corp");
      await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
      const field = screen.getByLabelText(/date applied/i);
      await userEvent.clear(field);
      await userEvent.type(field, future);
      await submit();

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ date_applied: future })
      );
    });

    it("ties the warning to the field for screen readers", async () => {
      setup();
      const field = screen.getByLabelText(/date applied/i);
      await userEvent.clear(field);
      await userEvent.type(field, future);

      expect(field).toHaveAccessibleDescription(warning);
    });
  });

  it("cancels without submitting", async () => {
    const { onSubmit, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
