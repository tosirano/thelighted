"use client";

/**
 * MenuClient — example admin table component demonstrating:
 *  - Optimistic toggle of `isActive` (no table flicker)
 *  - Per-row loading spinner on the affected row only
 *  - Automatic rollback + error toast on API failure
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToggleMenuItem, useDeleteMenuItem } from "@/hooks/useMenuMutations";
import type { MenuItem } from "@/lib/types/admin";

export function MenuClient() {
  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["admin", "menu"],
    queryFn: () => apiClient<MenuItem[]>("/api/admin/menu"),
  });

  const toggleMutation = useToggleMenuItem();
  const deleteMutation = useDeleteMenuItem();

  if (isLoading) {
    return <p className="p-4 text-sm text-gray-500">Loading menu…</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Active</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {items.map((item) => {
            const isToggling =
              toggleMutation.isPending &&
              (toggleMutation.variables as { id: string })?.id === item.id;
            const isDeleting =
              deleteMutation.isPending &&
              (deleteMutation.variables as string) === item.id;

            return (
              <tr key={item.id} className={isDeleting ? "opacity-50" : ""}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  ${item.price.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {isToggling ? (
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                      aria-label="Updating…"
                    />
                  ) : (
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: item.id,
                          isActive: !item.isActive,
                        })
                      }
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        item.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      aria-pressed={item.isActive}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isDeleting ? (
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent"
                      aria-label="Deleting…"
                    />
                  ) : (
                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                      aria-label={`Delete ${item.name}`}
                    >
                      Delete
                    </button>
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