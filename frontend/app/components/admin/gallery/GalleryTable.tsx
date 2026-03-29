"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import { Edit, Trash2, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Button } from "../../ui/Button";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/lib/api/admin";
import { galleryCategories } from "./GalleryForm";

interface GalleryTableProps {
  images: GalleryImage[];
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function GalleryTable({
  images,
  onToggleVisibility,
  onDelete,
}: GalleryTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    image: GalleryImage | null;
  }>({ isOpen: false, image: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const matchesSearch =
        searchFilter === "" ||
        img.alt.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || img.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [images, searchFilter, categoryFilter]);

  const columns = useMemo<ColumnDef<GalleryImage>[]>(
    () => [
      {
        accessorKey: "imageUrl",
        header: "Image",
        cell: ({ row }) => (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <Image
              src={row.original.imageUrl}
              alt={row.original.alt}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "alt",
        header: "Description",
        cell: ({ row }) => (
          <div className="max-w-xs">
            <p className="text-sm text-gray-900 line-clamp-2">
              {row.original.alt}
            </p>
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 hover:text-orange-600"
          >
            Category
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
            {row.original.category}
          </span>
        ),
      },
      {
        accessorKey: "displayOrder",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 hover:text-orange-600"
          >
            Order
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-gray-600">{row.original.displayOrder}</span>
        ),
      },
      {
        accessorKey: "isVisible",
        header: "Visible",
        cell: ({ row }) => (
          <button
            onClick={() => onToggleVisibility(row.original.id)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              row.original.isVisible ? "bg-green-500" : "bg-gray-300",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                row.original.isVisible ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        ),
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(`/admin/gallery/${row.original.id}`)
              }
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDeleteDialog({ isOpen: true, image: row.original })
              }
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onToggleVisibility, router],
  );

  const table = useReactTable({
    data: filteredImages,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 12 },
    },
  });

  const handleDelete = async () => {
    if (!deleteDialog.image) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteDialog.image.id);
      toast.success("Gallery image deleted successfully");
      setDeleteDialog({ isOpen: false, image: null });
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete image");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search images..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent capitalize"
          >
            <option value="all">All Categories</option>
            {galleryCategories.map((cat) => (
              <option key={cat} value={cat} className="capitalize">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No gallery images found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {table.getPageCount() > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length,
                )}
              </span>{" "}
              of{" "}
              <span className="font-medium">
                {table.getFilteredRowModel().rows.length}
              </span>{" "}
              results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        imageAlt={deleteDialog.image?.alt || ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, image: null })}
        isDeleting={isDeleting}
      />
    </div>
  );
}
