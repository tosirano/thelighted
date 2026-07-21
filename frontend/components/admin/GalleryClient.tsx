"use client";

/**
 * GalleryClient — demonstrates optimistic image deletion with per-row spinner
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useDeleteGalleryImage } from "@/hooks/useGalleryMutations";
import type { GalleryImage } from "@/lib/types/admin";

export function GalleryClient() {
  const { data: images = [], isLoading } = useQuery<GalleryImage[]>({
    queryKey: ["admin", "gallery"],
    queryFn: () => apiClient<GalleryImage[]>("/api/admin/gallery"),
  });

  const deleteMutation = useDeleteGalleryImage();

  if (isLoading) {
    return <p className="p-4 text-sm text-gray-500">Loading gallery…</p>;
  }

  if (images.length === 0) {
    return <p className="p-4 text-sm text-gray-500">No images yet.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => {
        const isDeleting =
          deleteMutation.isPending &&
          (deleteMutation.variables as string) === img.id;

        return (
          <li
            key={img.id}
            className={`relative rounded-lg border overflow-hidden ${
              isDeleting ? "opacity-50" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption ?? "Gallery image"}
              className="w-full aspect-square object-cover"
            />
            <div className="p-2 flex items-center justify-between">
              <span className="text-xs text-gray-600 truncate">
                {img.caption ?? "—"}
              </span>
              {isDeleting ? (
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent"
                  aria-label="Deleting…"
                />
              ) : (
                <button
                  onClick={() => deleteMutation.mutate(img.id)}
                  className="text-xs text-red-600 hover:text-red-800 underline ml-2 shrink-0"
                  aria-label="Delete image"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}