"use client";

/**
 * ContactsClient — demonstrates optimistic status badge update with per-row spinner
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useUpdateContactStatus } from "@/hooks/useContactMutations";
import type { Contact } from "@/lib/types/admin";

const STATUS_OPTIONS: Contact["status"][] = ["active", "inactive", "pending"];

function statusBadgeClass(status: Contact["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-600";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
  }
}

export function ContactsClient() {
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["admin", "contacts"],
    queryFn: () => apiClient<Contact[]>("/api/admin/contacts"),
  });

  const updateMutation = useUpdateContactStatus();

  if (isLoading) {
    return <p className="p-4 text-sm text-gray-500">Loading contacts…</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {contacts.map((contact) => {
            const isUpdating =
              updateMutation.isPending &&
              (updateMutation.variables as { id: string })?.id === contact.id;

            return (
              <tr key={contact.id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {contact.name}
                </td>
                <td className="px-4 py-3 text-gray-600">{contact.email}</td>
                <td className="px-4 py-3">
                  {isUpdating ? (
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                      aria-label="Updating status…"
                    />
                  ) : (
                    <select
                      value={contact.status}
                      onChange={(e) =>
                        updateMutation.mutate({
                          id: contact.id,
                          status: e.target.value as Contact["status"],
                        })
                      }
                      className={`text-xs font-medium px-2 py-0.5 rounded border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${statusBadgeClass(
                        contact.status
                      )}`}
                      aria-label={`Status for ${contact.name}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}