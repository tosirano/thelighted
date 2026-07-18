import { z } from "zod";
import type { ApiError } from "@/lib/types/api";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function handleUnauthorized(): void {
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  localStorage.removeItem("auth-token");
  toast.error("Session expired. Please log in again.");
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/**
 * Type-safe fetch wrapper.
 *
 * Optionally accepts a Zod schema — when provided, the response JSON is
 * parsed and validated before being returned. A ZodError is thrown (with
 * the field name) if the shape doesn't match, so mismatches surface before
 * reaching component state.
 */
export async function apiClient<T = unknown>(
  path: string,
  init: RequestInit = {},
  schema?: z.ZodType<T>
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
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    toast.error("Connection error. Please check your network.");
    throw new Error("Network error");
  }

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let parsed: Partial<ApiError> = {};
    try {
      parsed = JSON.parse(errorBody) as Partial<ApiError>;
    } catch {
      // non-JSON error body
    }
    throw new Error(parsed.message ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const json: unknown = await response.json();

  // Runtime Zod validation — throws ZodError with field name on mismatch
  if (schema) {
    return schema.parse(json);
  }

  return json as T;
}