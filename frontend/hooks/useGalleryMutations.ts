"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { GalleryImage } from "@/lib/types/admin";

const QUERY_KEY = ["admin", "gallery"];

// ── Delete image ───────────────────────────────────────────────────────────

export function useDeleteGalleryImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/admin/gallery/${id}`, { method: "DELETE" }),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previous = queryClient.getQueryData<GalleryImage[]>(QUERY_KEY);

      queryClient.setQueryData<GalleryImage[]>(QUERY_KEY, (old = []) =>
        old.filter((img) => img.id !== id)
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to delete image. Image restored.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ── Update caption ─────────────────────────────────────────────────────────

export function useUpdateGalleryImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, caption }: { id: string; caption: string }) =>
      apiClient(`/api/admin/gallery/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ caption }),
      }),

    onMutate: async ({ id, caption }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previous = queryClient.getQueryData<GalleryImage[]>(QUERY_KEY);

      queryClient.setQueryData<GalleryImage[]>(QUERY_KEY, (old = []) =>
        old.map((img) => (img.id === id ? { ...img, caption } : img))
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to update image. Change reverted.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}