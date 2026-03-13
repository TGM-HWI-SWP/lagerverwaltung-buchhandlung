// Zentraler Ort für API-Aufrufe zum FastAPI-Backend.
// Später können hier Basis-URL, Auth, Error-Handling etc. gekapselt werden.

const API_BASE_URL = "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API-Fehler: ${response.status}`);
  }
  return (await response.json()) as T;
}

