const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
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

export async function deleteApplication(id) {
  const res = await fetch(`${API_URL}/applications/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}
