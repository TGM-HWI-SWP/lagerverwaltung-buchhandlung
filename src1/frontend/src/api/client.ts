// Zentraler Ort für API-Aufrufe zum FastAPI-Backend.
// Später können hier Basis-URL, Auth, Error-Handling etc. gekapselt werden.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const AUTH_TOKEN_STORAGE = "buchmanagement.authToken";

function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(AUTH_TOKEN_STORAGE) || null;
  }
  return null;
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem(AUTH_TOKEN_STORAGE);
  else localStorage.setItem(AUTH_TOKEN_STORAGE, token);
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    if (typeof data.detail === "string" && data.detail.trim().length > 0) {
      return data.detail;
    }
  } catch {
    // Ignore JSON parsing errors and fall back to status text.
  }

  return response.status >= 500
    ? "Serverfehler. Bitte später noch einmal versuchen."
    : `API-Fehler: ${response.status}`;
}

function buildUrl(path: string, params: Record<string, unknown> = {}): string {
  const url = new URL(API_BASE_URL + path);
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, String(params[key]));
    }
  });
  return url.toString();
}

export async function apiGet<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = buildUrl(path, params);
  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return (await response.json()) as T;
}

async function sendJson<TResponse, TBody>(
  method: "POST" | "PUT",
  path: string,
  body: TBody,
): Promise<TResponse> {
  const token = getStoredToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
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
  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE", headers });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}
