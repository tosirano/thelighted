"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { MenuItem } from "@/lib/types/admin";

const QUERY_KEY = ["admin", "menu"];

// ── Toggle active state ────────────────────────────────────────────────────

export function useToggleMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient(`/api/admin/menu/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),

    onMutate: async ({ id, isActive }) => {
      // Cancel in-flight refetches so they don't overwrite optimistic state
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previous = queryClient.getQueryData<MenuItem[]>(QUERY_KEY);

      queryClient.setQueryData<MenuItem[]>(QUERY_KEY, (old = []) =>
        old.map((item) => (item.id === id ? { ...item, isActive } : item))
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to update menu item. Change reverted.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ── Delete item ────────────────────────────────────────────────────────────

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/admin/menu/${id}`, { method: "DELETE" }),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previous = queryClient.getQueryData<MenuItem[]>(QUERY_KEY);

      queryClient.setQueryData<MenuItem[]>(QUERY_KEY, (old = []) =>
        old.filter((item) => item.id !== id)
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to delete menu item. Item restored.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}