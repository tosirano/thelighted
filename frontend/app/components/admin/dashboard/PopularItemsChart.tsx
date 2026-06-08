"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

interface PopularItem {
  id: string;
  name: string;
  clicks: number;
}

interface PopularItemsChartProps {
  items: PopularItem[];
}

export default function PopularItemsChart({ items }: PopularItemsChartProps) {
  const chartData = items.map((item) => ({
    name:
      item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
    clicks: item.clicks,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Popular Items
      </h3>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No data available yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#111827", fontWeight: "bold" }}
              cursor={{ fill: "rgba(249, 115, 22, 0.1)" }}
            />
            <Bar
              dataKey="clicks"
              fill="url(#colorGradient)"
              radius={[8, 8, 0, 0]}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}