"use client";

/**
 * RecentActivity
 *
 * Dashboard activity feed — in its own file so it can be code-split via
 * Next.js dynamic(). Heavy date formatting and list rendering stays out of
 * the initial bundle.
 */
import { formatDistanceToNow } from "date-fns";

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

const TYPE_COLORS: Record<string, string> = {
  booking:  "bg-blue-100 text-blue-700",
  payment:  "bg-green-100 text-green-700",
  checkin:  "bg-purple-100 text-purple-700",
  cancellation: "bg-red-100 text-red-700",
};

export function RecentActivity({ items }: RecentActivityProps) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No recent activity.
      </p>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Recent activity">
      {items.map((item) => {
        const colorClass =
          TYPE_COLORS[item.type.toLowerCase()] ?? "bg-gray-100 text-gray-600";
        return (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase ${colorClass}`}
              aria-hidden="true"
            >
              {item.type.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-gray-800 truncate">
                {item.description}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                <time dateTime={item.createdAt}>
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                  })}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}