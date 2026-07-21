"use client";

/**
 * PopularItemsChart
 *
 * Heavy Recharts component — intentionally in its own file so Next.js
 * dynamic() can split it into a separate JS chunk.
 *
 * The BarChart and related Recharts classes will NOT appear in the initial
 * JS payload; they load only when this component is needed.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface PopularItem {
  name: string;
  bookings: number;
}

interface PopularItemsChartProps {
  data: PopularItem[];
}

export function PopularItemsChart({ data }: PopularItemsChartProps) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-12">
        No data available yet.
      </p>
    );
  }

  return (
    <div className="w-full h-64" aria-label="Popular items chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            cursor={{ fill: "#f5f5f5" }}
          />
          <Bar dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}