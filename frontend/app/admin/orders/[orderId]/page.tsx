"use client";

import { useParams } from "next/navigation";
import { useNotifications } from "@/lib/store/notificationStore";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const notifications = useNotifications();
  const order = notifications.find(
    (n) => n.orderId === orderId && n.type === "order:new"
  );

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">
          Order not found in this session. It may have arrived before this
          page loaded, or on a previous session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Order #{order.orderNumber}
      </h1>
      <dl className="grid max-w-md grid-cols-2 gap-4 rounded-lg border bg-white p-4">
        <dt className="text-sm text-gray-500">Status</dt>
        <dd className="text-sm font-medium capitalize text-gray-900">
          {order.status}
        </dd>
        <dt className="text-sm text-gray-500">Received</dt>
        <dd className="text-sm font-medium text-gray-900">
          {new Date(order.createdAt).toLocaleString()}
        </dd>
      </dl>
    </div>
  );
}
