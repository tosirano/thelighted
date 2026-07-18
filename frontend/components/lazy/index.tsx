/**
 * Dynamically imported heavy dashboard components.
 *
 * Using Next.js dynamic() with ssr: false splits each into a separate JS
 * chunk so Recharts and table libraries are NOT in the initial payload.
 * Each import is paired with its Suspense skeleton fallback.
 */
import dynamic from "next/dynamic";
import { ChartSkeleton, ActivitySkeleton } from "@/components/skeletons";

/**
 * PopularItemsChart — lazy-loaded Recharts chart.
 * Recharts code appears in its own JS chunk (not bundled into main).
 */
export const PopularItemsChart = dynamic(
  () =>
    import("@/components/charts/PopularItemsChart").then(
      (mod) => mod.PopularItemsChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

/**
 * RecentActivity — lazy-loaded activity feed.
 */
export const RecentActivity = dynamic(
  () =>
    import("@/components/dashboard/RecentActivity").then(
      (mod) => mod.RecentActivity
    ),
  {
    ssr: false,
    loading: () => <ActivitySkeleton />,
  }
);