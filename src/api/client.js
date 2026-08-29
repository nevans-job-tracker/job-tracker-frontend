const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Turns an API error body into something worth showing a person.
 *
 * FastAPI reports its own validation failures as a list of objects, e.g.
 * [{ loc: ["body", "date_applied"], msg: "Input should be a valid date" }],
 * which renders as "[object Object]" if passed straight to Error(). Rules we
 * enforce ourselves raise a plain string instead, so both shapes arrive here.
 */
function formatDetail(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;

  return detail
    .map((item) => {
      const field = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : null;
      const message = item.msg || "Invalid value";
      return field ? `${field}: ${message}` : message;
    })
    .join("; ");
}

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = formatDetail(body.detail) || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listApplications(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  ).toString();
  const res = await fetch(`${API_URL}/applications${query ? `?${query}` : ""}`);
  return handleResponse(res);
}

/**
 * The distinct sources, for the list's Source filter (KAN-56).
 *
 * A separate call rather than a field on the list response: that response is
 * filtered and paginated, so choosing a source would collapse the options to
 * that one value and leave no way back.
 */
export async function listSources() {
  const res = await fetch(`${API_URL}/applications/sources`);
  return handleResponse(res);
}

export async function getStatusHistory(id) {
  const res = await fetch(`${API_URL}/applications/${id}/history`);
  return handleResponse(res);
}

export async function getApplication(id) {
  const res = await fetch(`${API_URL}/applications/${id}`);
  return handleResponse(res);
}

export async function createApplication(data) {
  const res = await fetch(`${API_URL}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateApplication(id, data) {
  const res = await fetch(`${API_URL}/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// Applications are archived, never deleted — there is no delete call here by
// design. Archiving is reversible, so neither of these prompts for confirmation.
export async function archiveApplication(id) {
  const res = await fetch(`${API_URL}/applications/${id}/archive`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function unarchiveApplication(id) {
  const res = await fetch(`${API_URL}/applications/${id}/unarchive`, {
    method: "POST",
  });
  return handleResponse(res);
}

// Contacts are nested under their application: the API scopes every lookup by
// application_id, so the parent id is required on each call.
export async function createContact(applicationId, data) {
  const res = await fetch(`${API_URL}/applications/${applicationId}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateContact(applicationId, contactId, data) {
  const res = await fetch(
    `${API_URL}/applications/${applicationId}/contacts/${contactId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return handleResponse(res);
}

export async function deleteContact(applicationId, contactId) {
  const res = await fetch(
    `${API_URL}/applications/${applicationId}/contacts/${contactId}`,
    { method: "DELETE" }
  );
  return handleResponse(res);
}
