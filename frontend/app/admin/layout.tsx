"use client";

import ProtectedRoute from "@/providers/ProtectedRoute";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";

function AdminShell({ children }: { children: React.ReactNode }) {
  // Mounted once for the whole /admin section so the notification socket
  // stays connected across route changes instead of reconnecting per page.
  useOrderNotifications();

  return (
    <div className="flex h-full min-h-screen">
      <AdminSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  );
}
