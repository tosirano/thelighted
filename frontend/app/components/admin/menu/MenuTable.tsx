// frontend/src/components/admin/menu/MenuTable.tsx
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
import { Edit, Trash2, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { MenuItem, MenuCategory } from "@/lib/types/menu";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "../../ui/Button";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface MenuTableProps {
  items: MenuItem[];
  onToggleAvailability: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function MenuTable({
  items,
  onToggleAvailability,
  onDelete,
}: MenuTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    item: MenuItem | null;
  }>({ isOpen: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<ColumnDef<MenuItem>[]>(
    () => [
      {
        accessorKey: "image",
        header: "Image",
        cell: ({ row }) => (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={row.original.image}
              alt={row.original.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 hover:text-orange-600"
          >
            Name
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-gray-900">
              {row.original.name}
            </div>
            <div className="text-xs text-gray-500 line-clamp-1 max-w-[300px]">
              {row.original.description}
            </div>
          </div>
        ),
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
        accessorKey: "price",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 hover:text-orange-600"
          >
            Price
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.original.price)}
          </span>
        ),
      },
      {
        accessorKey: "isAvailable",
        header: "Available",
        cell: ({ row }) => (
          <button
            onClick={() => onToggleAvailability(row.original.id)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              row.original.isAvailable ? "bg-green-500" : "bg-gray-300",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                row.original.isAvailable ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        ),
      },
      {
        accessorKey: "clickCount",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 hover:text-orange-600"
          >
            Clicks
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-gray-600">{row.original.clickCount || 0}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/menu/${row.original.id}`)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDeleteDialog({ isOpen: true, item: row.original })
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
    [onToggleAvailability, router],
  );

  const filteredData = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleDelete = async () => {
    if (!deleteDialog.item) return;

    setIsDeleting(true);
    try {
      await onDelete(deleteDialog.item.id);
      toast.success("Menu item deleted successfully");
      setDeleteDialog({ isOpen: false, item: null });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete item");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search menu items..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent capitalize"
        >
          <option value="all">All Categories</option>
          {Object.values(MenuCategory).map((category) => (
            <option key={category} value={category} className="capitalize">
              {category}
            </option>
          ))}
        </select>
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
                    No menu items found
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
        itemName={deleteDialog.item?.name || ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, item: null })}
        isDeleting={isDeleting}
      />
    </div>
  );
}
