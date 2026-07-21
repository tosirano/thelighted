"use client";

import { useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  useNotifications,
  useNotificationActions,
} from "@/lib/store/notificationStore";

export default function OrdersPage() {
  const notifications = useNotifications();
  const { clearUnread } = useNotificationActions();

  // Acceptance criteria: the unread badge clears as soon as the admin
  // visits this page, regardless of how they got here (badge click, toast,
  // or direct nav).
  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  const orders = notifications.filter((n) => n.type === "order:new");

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Orders</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">
          No orders yet. New orders will appear here in real time.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white" aria-label="Orders">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/orders/${order.orderId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    Order #{order.orderNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    <time dateTime={order.createdAt}>
                      {formatDistanceToNow(new Date(order.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium capitalize text-gray-700">
                  {order.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
