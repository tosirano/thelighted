import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Clears auth state and redirects to /login.
 * Uses window.location so it works outside React render (e.g. fetch interceptor).
 */
function handleUnauthorized(): void {
  // Clear any persisted auth state (cookies, localStorage tokens)
  document.cookie =
    "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  localStorage.removeItem("auth-token");

  toast.error("Session expired. Please log in again.");

  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/**
 * Thin fetch wrapper that:
 *  - Prepends the API base URL
 *  - Attaches the Authorization header if a token is present
 *  - Intercepts 401 responses: clears auth state and redirects to /login
 *  - Shows a toast on network failure
 */
export async function apiClient<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("auth-token")
      : null;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    toast.error("Connection error. Please check your network.");
    throw new Error("Network error");
  }

  // 401 — expired / missing token: clear state and redirect
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `HTTP ${response.status}`);
  }

  // Return undefined for 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}