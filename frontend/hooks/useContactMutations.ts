"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { Contact } from "@/lib/types/admin";

const QUERY_KEY = ["admin", "contacts"];

// ── Update contact status ──────────────────────────────────────────────────

export function useUpdateContactStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Contact["status"];
    }) =>
      apiClient(`/api/admin/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),

    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previous = queryClient.getQueryData<Contact[]>(QUERY_KEY);

      queryClient.setQueryData<Contact[]>(QUERY_KEY, (old = []) =>
        old.map((c) => (c.id === id ? { ...c, status } : c))
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to update contact status. Change reverted.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ── Delete contact ─────────────────────────────────────────────────────────

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/admin/contacts/${id}`, { method: "DELETE" }),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previous = queryClient.getQueryData<Contact[]>(QUERY_KEY);

      queryClient.setQueryData<Contact[]>(QUERY_KEY, (old = []) =>
        old.filter((c) => c.id !== id)
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to delete contact. Contact restored.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}