"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  timestamp: string;
  admin?: {
    username: string;
  };
}

interface RecentActivityProps {
  logs: AuditLog[];
}

const getActionIcon = (action: string) => {
  const firstWord = action.toLowerCase().split(" ")[0];

  switch (firstWord) {
    case "created":
      return "✨";
    case "updated":
      return "📝";
    case "deleted":
      return "🗑️";
    case "toggled":
      return "🔄";
    default:
      return "📌";
  }
};

const getActionColor = (action: string) => {
  const firstWord = action.toLowerCase().split(" ")[0];

  switch (firstWord) {
    case "created":
      return "text-green-600 bg-green-50";
    case "updated":
      return "text-blue-600 bg-blue-50";
    case "deleted":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
};

export default function RecentActivity({ logs }: RecentActivityProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </h3>
        <Link href="/admin/audit-logs">
          <Button variant="ghost" size="sm" className="gap-2">
            View All
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No recent activity
        </div>
      ) : (
        <div className="space-y-4">
          {logs.slice(0, 5).map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ${getActionColor(
                  log.action
                )}`}
              >
                {getActionIcon(log.action)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {log.action}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  by {log.admin?.username || "System"} •{" "}
                  {formatDistanceToNow(new Date(log.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                  {log.entityType}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}