"use client";

import React from "react";
import { AdminRole } from "@/lib/types/user";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: AdminRole | undefined;
  className?: string;
}

const roleConfig: Record<
  AdminRole,
  { label: string; icon: string; styles: string }
> = {
  [AdminRole.SUPER_ADMIN]: {
    label: "Super Admin",
    icon: "👑",
    styles: "bg-purple-100 text-purple-700 border-purple-300",
  },
  [AdminRole.ADMIN]: {
    label: "Admin",
    icon: "⭐",
    styles: "bg-blue-100 text-blue-700 border-blue-300",
  },
  [AdminRole.MANAGER]: {
    label: "Manager",
    icon: "👤",
    styles: "bg-green-100 text-green-700 border-green-300",
  },
  [AdminRole.STAFF]: {
    label: "Staff",
    icon: "🔥",
    styles: "bg-green-100 text-green-700 border-green-300",
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  if (!role || !roleConfig[role]) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
          "bg-gray-100 text-gray-600 border-gray-300",
          className,
        )}
      >
        <span>❓</span>
        Unknown
      </span>
    );
  }

  const { label, icon, styles } = roleConfig[role];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        styles,
        className,
      )}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
