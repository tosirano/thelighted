"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";
import { AdminRole } from "@/lib/types/user";
import RoleProtectedPage from "@/app/components/admin/RoleProtectedPage";
import PopularItemsChart from "@/app/components/admin/dashboard/PopularItemsChart";
import RecentActivity from "@/app/components/admin/dashboard/RecentActivity";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function QuickActions() {
  const links = [
    { label: "Add Menu Item", href: "/admin/menu/new" },
    { label: "View Contacts", href: "/admin/contacts" },
    { label: "Manage Users", href: "/admin/users" },
  ];
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-gray-700">Quick Actions</h2>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-sm text-blue-600 hover:underline">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardClient() {
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === AdminRole.STAFF;

  const {
    data: stats,
    isLoading: loadingStats,
    error: statsError,
  } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: adminApi.getDashboard,
    staleTime: 60_000,
  });

  const {
    data: analytics,
    isLoading: loadingAnalytics,
    error: analyticsError,
  } = useQuery({
    queryKey: ["menu-analytics"],
    queryFn: adminApi.getMenuAnalytics,
    staleTime: 60_000,
  });

  const {
    data: auditLogs,
    isLoading: loadingLogs,
    error: logsError,
  } = useQuery({
    queryKey: ["audit-logs", 10],
    queryFn: () => adminApi.getAuditLogs(10),
    staleTime: 30_000,
  });

  const isLoading = loadingStats || loadingAnalytics || loadingLogs;
  const error = statsError || analyticsError || logsError;

  return (
    <RoleProtectedPage
      allowedRoles={[
        AdminRole.SUPER_ADMIN,
        AdminRole.ADMIN,
        AdminRole.MANAGER,
        AdminRole.STAFF,
      ]}
    >
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            Failed to load dashboard data.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Menu Items" value={stats?.menu.total ?? 0} />
            <StatCard label="Available Items" value={stats?.menu.available ?? 0} />
            <StatCard label="Last 7 Days Views" value={stats?.analytics.last7Days ?? 0} />
            {!isStaff && (
              <StatCard label="New Contact Submissions" value={stats?.contacts.new ?? 0} />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {loadingAnalytics ? (
            <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
          ) : (
            <PopularItemsChart items={analytics?.popularItems ?? []} />
          )}
          <QuickActions />
        </div>

        {loadingLogs ? (
          <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
        ) : (
          <RecentActivity logs={auditLogs ?? []} />
        )}
      </div>
    </RoleProtectedPage>
  );
}
