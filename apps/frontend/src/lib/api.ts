const queryApiBase = new URLSearchParams(window.location.search).get("apiBase");
const configuredApiBase = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE_URL = (queryApiBase || configuredApiBase || "http://127.0.0.1:4310").replace(/\/$/, "");

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body
      ? String(body.message)
      : `La solicitud falló con estado ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}
