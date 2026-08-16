import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationForm from "./ApplicationForm.jsx";

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
    await userEvent.type(screen.getByLabelText(/company/i), "Acme Corp");
    await userEvent.type(screen.getByLabelText(/role title/i), "QA Engineer");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ company: "Acme Corp", role_title: "QA Engineer" })
    );
  });

  it("sends null rather than empty strings for untouched optional fields", async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText(/company/i), "Acme Corp");
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
    ]) {
      expect(payload[field], `${field} should be null`).toBeNull();
    }
    expect(payload.salary_min).toBeNull();
    expect(payload.salary_max).toBeNull();
  });

  it("converts salary inputs to numbers", async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText(/company/i), "Acme Corp");
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
      expect(screen.getByLabelText(/company/i)).toHaveValue("Northwind");
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
      await userEvent.clear(screen.getByLabelText(/company/i));
      await userEvent.type(screen.getByLabelText(/company/i), "Northwind Traders");
      await submit();

      const payload = onSubmit.mock.calls[0][0];
      expect(payload.company).toBe("Northwind Traders");
      expect(payload.location).toBe("Austin, TX");
      expect(payload.status).toBe("interview");
    });
  });

  it("surfaces a failure from the submit handler", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Company already tracked"));
    render(<ApplicationForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/company/i), "Acme Corp");
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
      await userEvent.type(screen.getByLabelText(/company/i), "Acme Corp");
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
