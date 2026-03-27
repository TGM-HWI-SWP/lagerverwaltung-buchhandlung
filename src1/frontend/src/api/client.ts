// Zentraler Ort für API-Aufrufe zum FastAPI-Backend.
// Später können hier Basis-URL, Auth, Error-Handling etc. gekapselt werden.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API-Fehler: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function sendJson<TResponse, TBody>(
  method: "POST" | "PUT",
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API-Fehler: ${response.status}`);
  }
  return (await response.json()) as TResponse;
}

export function apiPost<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return sendJson<TResponse, TBody>("POST", path, body);
}

export function apiPut<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return sendJson<TResponse, TBody>("PUT", path, body);
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`API-Fehler: ${response.status}`);
  }
}

