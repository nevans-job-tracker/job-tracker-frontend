import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsEditor from "./ContactsEditor.jsx";
import { createContact, updateContact, deleteContact } from "../api/client.js";

vi.mock("../api/client.js", () => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

const CONTACTS = [
  {
    id: 11,
    application_id: 5,
    name: "Dana Wu",
    title: "Sr. Quality Engineer",
    phone: "+1 555-0142 x231",
    email: "dana@acme.example",
    notes: "Mentioned the team is splitting in Q4.",
  },
  {
    id: 12,
    application_id: 5,
    name: "Sam Ortiz",
    title: null,
    phone: null,
    email: null,
    notes: null,
  },
];

function setup(contacts = CONTACTS) {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(
    <ContactsEditor applicationId={5} contacts={contacts} onChanged={onChanged} />
  );
  return { onChanged };
}

const cardFor = (name) => screen.getByText(name).closest(".contact-card");

beforeEach(() => {
  vi.clearAllMocks();
  createContact.mockResolvedValue({});
  updateContact.mockResolvedValue({});
  deleteContact.mockResolvedValue(null);
});

describe("ContactsEditor", () => {
  describe("display", () => {
    it("lists every contact", () => {
      setup();
      expect(screen.getByText("Dana Wu")).toBeInTheDocument();
      expect(screen.getByText("Sam Ortiz")).toBeInTheDocument();
    });

    it("shows the details that are present", () => {
      setup();
      const card = cardFor("Dana Wu");
      expect(within(card).getByText("Sr. Quality Engineer")).toBeInTheDocument();
      expect(within(card).getByText("+1 555-0142 x231")).toBeInTheDocument();
      expect(
        within(card).getByText("Mentioned the team is splitting in Q4.")
      ).toBeInTheDocument();
    });

    it("links the email address", () => {
      setup();
      expect(screen.getByRole("link", { name: "dana@acme.example" })).toHaveAttribute(
        "href",
        "mailto:dana@acme.example"
      );
    });

    it("omits rows for absent details", () => {
      setup();
      const card = cardFor("Sam Ortiz");
      expect(within(card).queryByText("Phone")).not.toBeInTheDocument();
      expect(within(card).queryByText("Email")).not.toBeInTheDocument();
    });

    it("shows an empty state when there are none", () => {
      setup([]);
      expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument();
    });
  });

  describe("adding", () => {
    it("sends the typed values, with blanks as null", async () => {
      const { onChanged } = setup();
      await userEvent.click(screen.getByRole("button", { name: /add contact/i }));
      await userEvent.type(screen.getByLabelText(/name/i), "Jo Rivera");
      await userEvent.type(screen.getByLabelText(/title/i), "Hiring Manager");
      await userEvent.click(screen.getByRole("button", { name: /^add contact$/i }));

      expect(createContact).toHaveBeenCalledWith(5, {
        name: "Jo Rivera",
        title: "Hiring Manager",
        phone: null,
        email: null,
        notes: null,
      });
      expect(onChanged).toHaveBeenCalled();
    });

    it("closes the form without sending anything on cancel", async () => {
      setup();
      await userEvent.click(screen.getByRole("button", { name: /add contact/i }));
      await userEvent.type(screen.getByLabelText(/name/i), "Discarded");
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(createContact).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    });

    it("surfaces a failure from the API", async () => {
      createContact.mockRejectedValue(new Error("Contact name already used"));
      setup();
      await userEvent.click(screen.getByRole("button", { name: /add contact/i }));
      await userEvent.type(screen.getByLabelText(/name/i), "Jo Rivera");
      await userEvent.click(screen.getByRole("button", { name: /^add contact$/i }));

      expect(await screen.findByText("Contact name already used")).toBeInTheDocument();
    });
  });

  describe("editing", () => {
    it("opens populated with the existing values", async () => {
      setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /edit/i }));
      expect(screen.getByLabelText(/name/i)).toHaveValue("Dana Wu");
      expect(screen.getByLabelText(/title/i)).toHaveValue("Sr. Quality Engineer");
    });

    it("sends the change against the right contact id", async () => {
      const { onChanged } = setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText(/title/i));
      await userEvent.type(screen.getByLabelText(/title/i), "QA Manager");
      await userEvent.click(screen.getByRole("button", { name: /save contact/i }));

      expect(updateContact).toHaveBeenCalledWith(
        5,
        11,
        expect.objectContaining({ name: "Dana Wu", title: "QA Manager" })
      );
      expect(onChanged).toHaveBeenCalled();
    });

    it("does not send server-managed fields back", async () => {
      setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /edit/i }));
      await userEvent.click(screen.getByRole("button", { name: /save contact/i }));

      const payload = updateContact.mock.calls[0][2];
      expect(payload).not.toHaveProperty("id");
      expect(payload).not.toHaveProperty("application_id");
    });

    it("discards the edit on cancel", async () => {
      setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText(/title/i));
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(updateContact).not.toHaveBeenCalled();
      expect(screen.getByText("Sr. Quality Engineer")).toBeInTheDocument();
    });
  });

  describe("removing", () => {
    // Contacts are hard-deleted by design — a contact is a detail of an
    // application, not history worth keeping. See REQUIREMENTS.md §2.1.
    it("deletes after the prompt is confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const { onChanged } = setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /remove/i }));

      expect(deleteContact).toHaveBeenCalledWith(5, 11);
      expect(onChanged).toHaveBeenCalled();
    });

    it("does nothing when the prompt is dismissed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const { onChanged } = setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /remove/i }));

      expect(deleteContact).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it("names the contact in the prompt", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      setup();
      await userEvent.click(within(cardFor("Dana Wu")).getByRole("button", { name: /remove/i }));

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("Dana Wu")
      );
    });
  });
});
