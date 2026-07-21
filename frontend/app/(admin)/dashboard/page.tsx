"use client";

/**
 * Admin Dashboard page
 *
 * Demonstrates:
 *  - dynamic() lazy imports for chart and activity chunks
 *  - <Suspense> boundaries with matching skeleton fallbacks per section
 *  - useTransition for navigation-triggered data loads (tab switching)
 *  - Static page title + nav visible before any data loads
 */
import { Suspense, useTransition, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PopularItemsChart, RecentActivity } from "@/components/lazy";
import {
  ChartSkeleton,
  TableSkeleton,
  ActivitySkeleton,
} from "@/components/skeletons";

type Period = "7d" | "30d" | "90d";

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [isPending, startTransition] = useTransition();

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/dashboard?period=${period}`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  function handlePeriodChange(next: Period) {
    startTransition(() => setPeriod(next));
  }

  const PERIODS: { label: string; value: Period }[] = [
    { label: "7 days", value: "7d" },
    { label: "30 days", value: "30d" },
    { label: "90 days", value: "90d" },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Static page title — visible immediately, no data dependency */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

        {/* Period switcher — uses useTransition to mark load as non-urgent */}
        <div
          role="group"
          aria-label="Time period"
          className="flex gap-1 rounded-lg border p-1"
        >
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handlePeriodChange(value)}
              disabled={isPending}
              aria-pressed={period === value}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                period === value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              } disabled:opacity-60`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Popular items chart — loads in its own chunk; skeleton shown while loading */}
      <section aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="text-lg font-semibold text-gray-800 mb-3">
          Popular Workspaces
        </h2>
        <Suspense fallback={<ChartSkeleton />}>
          <PopularItemsChart data={stats?.topWorkspaces ?? []} />
        </Suspense>
      </section>

      {/* Recent activity — loads in its own chunk */}
      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-lg font-semibold text-gray-800 mb-3">
          Recent Activity
        </h2>
        <Suspense fallback={<ActivitySkeleton rows={5} />}>
          <RecentActivity items={stats?.recentActivity ?? []} />
        </Suspense>
      </section>

      {/* Admin data table — skeleton while data fetches */}
      <section aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="text-lg font-semibold text-gray-800 mb-3">
          Recent Bookings
        </h2>
        <Suspense fallback={<TableSkeleton rows={8} />}>
          {/* BookingsTable would be dynamically imported here */}
          <TableSkeleton rows={8} />
        </Suspense>
      </section>
    </div>
  );
}