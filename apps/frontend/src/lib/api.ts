const queryApiBase = new URLSearchParams(window.location.search).get("apiBase");
const configuredApiBase = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE_URL = (queryApiBase || configuredApiBase || "http://127.0.0.1:4310").replace(/\/$/, "");
export const AUTH_TOKEN_KEY = "presucontrol.auth.token";

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token: string) {
  if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  else window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login") {
      setAuthToken("");
      window.dispatchEvent(new CustomEvent("presucontrol:unauthorized"));
    }
    const message = body && typeof body === "object" && "message" in body
      ? String(body.message)
      : `La solicitud falló con estado ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export function postJson<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patchJson<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteRequest<T>(path: string) {
  return apiRequest<T>(path, { method: "DELETE" });
}
