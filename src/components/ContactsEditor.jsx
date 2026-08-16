import { useState } from "react";
import {
  createContact,
  updateContact,
  deleteContact,
} from "../api/client.js";

const emptyContact = { name: "", title: "", phone: "", email: "", notes: "" };

// Blank optional fields are stored as NULL, not "", matching the application
// form. Otherwise an untouched field reads as a deliberately empty value.
function toPayload(contact) {
  return {
    name: contact.name,
    title: contact.title || null,
    phone: contact.phone || null,
    email: contact.email || null,
    notes: contact.notes || null,
  };
}

function ContactFields({ value, onChange }) {
  return (
    <>
      <div className="form-row">
        <label>
          Name *
          <input
            required
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </label>
        <label>
          Title
          <input
            placeholder="Manager, HR, Sr. Quality Engineer..."
            value={value.title || ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Phone
          <input
            value={value.phone || ""}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={value.email || ""}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </label>
      </div>
      <label className="form-notes">
        Notes
        <textarea
          rows={2}
          placeholder="Something specific they mentioned..."
          value={value.notes || ""}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
        />
      </label>
    </>
  );
}

export default function ContactsEditor({ applicationId, contacts, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyContact);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyContact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    await run(async () => {
      await createContact(applicationId, toPayload(draft));
      setDraft(emptyContact);
      setAdding(false);
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    await run(async () => {
      await updateContact(applicationId, editingId, toPayload(editDraft));
      setEditingId(null);
    });
  }

  async function handleDelete(contact) {
    if (!confirm(`Remove ${contact.name} from this application?`)) return;
    await run(() => deleteContact(applicationId, contact.id));
  }

  return (
    <section className="contacts">
      <div className="contacts-header">
        <h2>Contacts</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} disabled={busy}>
            + Add contact
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {adding && (
        <form className="contact-card" onSubmit={handleAdd}>
          <ContactFields value={draft} onChange={setDraft} />
          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft(emptyContact);
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              Add contact
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 && !adding && (
        <p className="empty-state">No contacts yet.</p>
      )}

      {contacts.map((contact) =>
        editingId === contact.id ? (
          <form key={contact.id} className="contact-card" onSubmit={handleSaveEdit}>
            <ContactFields value={editDraft} onChange={setEditDraft} />
            <div className="form-actions">
              <button type="button" onClick={() => setEditingId(null)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" disabled={busy}>
                Save contact
              </button>
            </div>
          </form>
        ) : (
          <div key={contact.id} className="contact-card">
            <div className="contact-summary">
              <div>
                <strong>{contact.name}</strong>
                {contact.title && <span className="cell-sub">{contact.title}</span>}
              </div>
              <div className="contact-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(contact.id);
                    setEditDraft({ ...emptyContact, ...contact });
                  }}
                  disabled={busy}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(contact)}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
            </div>
            <dl className="contact-details">
              {contact.phone && (
                <>
                  <dt>Phone</dt>
                  <dd>{contact.phone}</dd>
                </>
              )}
              {contact.email && (
                <>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </dd>
                </>
              )}
              {contact.notes && (
                <>
                  <dt>Notes</dt>
                  <dd>{contact.notes}</dd>
                </>
              )}
            </dl>
          </div>
        )
      )}
    </section>
  );
}
