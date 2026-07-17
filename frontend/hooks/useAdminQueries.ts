/**
 * Type-safe React Query hooks for admin endpoints.
 * Every useQuery / useMutation call has explicit generic type parameters.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  MenuItemListSchema,
  GalleryImageListSchema,
  AdminUserListSchema,
  DashboardStatsSchema,
  AnalyticsSchema,
} from "@/lib/schemas/api.schemas";
import type {
  MenuItem,
  GalleryImage,
  AdminUser,
  DashboardStats,
  Analytics,
} from "@/lib/schemas/api.schemas";
import type { ApiError, MutationSuccessResponse } from "@/lib/types/api";
import { toast } from "sonner";

// ── Menu ───────────────────────────────────────────────────────────────────

export function useMenuItems() {
  return useQuery<MenuItem[], ApiError>({
    queryKey: ["admin", "menu"],
    queryFn: () =>
      apiClient<MenuItem[]>("/api/admin/menu", {}, MenuItemListSchema),
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation<MutationSuccessResponse, ApiError, { id: string; isActive: boolean }>({
    mutationFn: ({ id, isActive }) =>
      apiClient<MutationSuccessResponse>(`/api/admin/menu/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onError: (err) => toast.error(err.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "menu"] }),
  });
}

// ── Gallery ────────────────────────────────────────────────────────────────

export function useGalleryImages() {
  return useQuery<GalleryImage[], ApiError>({
    queryKey: ["admin", "gallery"],
    queryFn: () =>
      apiClient<GalleryImage[]>("/api/admin/gallery", {}, GalleryImageListSchema),
  });
}

// ── Admin users ────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery<AdminUser[], ApiError>({
    queryKey: ["admin", "users"],
    queryFn: () =>
      apiClient<AdminUser[]>("/api/admin/users", {}, AdminUserListSchema),
  });
}

// ── Dashboard stats ────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery<DashboardStats, ApiError>({
    queryKey: ["admin", "dashboard"],
    queryFn: () =>
      apiClient<DashboardStats>("/api/admin/dashboard", {}, DashboardStatsSchema),
  });
}

// ── Analytics ──────────────────────────────────────────────────────────────

export function useAnalytics(period: string) {
  return useQuery<Analytics, ApiError>({
    queryKey: ["admin", "analytics", period],
    queryFn: () =>
      apiClient<Analytics>(
        `/api/admin/analytics?period=${period}`,
        {},
        AnalyticsSchema
      ),
  });
}