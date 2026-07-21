"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthState } from "@/lib/store/authStore";
import { useNotificationActions } from "@/lib/store/notificationStore";
import { connectSocket } from "@/lib/socket/socketClient";

interface NewOrderEvent {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  status: string;
  updatedAt: string;
}

function NewOrderToastBody({
  toastId,
  event,
  onNavigate,
}: {
  toastId: string | number;
  event: NewOrderEvent;
  onNavigate: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onNavigate();
        toast.dismiss(toastId);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onNavigate();
          toast.dismiss(toastId);
        }
      }}
      className="flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 shadow-lg"
    >
      <div className="flex-1">
        <p className="font-semibold text-gray-900">
          New order #{event.orderNumber}
        </p>
        <p className="text-sm text-gray-600">
          ${event.total.toFixed(2)} · tap to view
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(toastId);
        }}
        aria-label="Dismiss notification"
        className="text-gray-400 hover:text-gray-600"
      >
        &times;
      </button>
    </div>
  );
}

/**
 * Subscribes to order:new / order:status_changed on the /orders socket
 * namespace for the lifetime of the mounting component (intended to be the
 * admin layout, so it stays connected across admin route changes). The
 * underlying socket is only torn down explicitly on logout — see
 * disconnectSocket() — not on this hook's unmount, so navigating within the
 * admin section doesn't cause reconnect flicker.
 */
export function useOrderNotifications(): void {
  const router = useRouter();
  const { token, isAuthenticated, _hasHydrated } = useAuthState();
  const { addNotification } = useNotificationActions();

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return;

    const socket = connectSocket(token);

    const handleNewOrder = (event: NewOrderEvent) => {
      addNotification({
        id: `${event.orderId}-new-${event.createdAt}`,
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        type: "order:new",
        status: event.status,
        message: `New order #${event.orderNumber}`,
        createdAt: event.createdAt,
      });

      toast.custom(
        (toastId) => (
          <NewOrderToastBody
            toastId={toastId}
            event={event}
            onNavigate={() => router.push(`/admin/orders/${event.orderId}`)}
          />
        ),
        { duration: Infinity }
      );
    };

    const handleStatusChanged = (event: OrderStatusChangedEvent) => {
      toast(`Order #${event.orderNumber} is now ${event.status}`, {
        action: {
          label: "View",
          onClick: () => router.push(`/admin/orders/${event.orderId}`),
        },
      });
    };

    const handleConnectionError = (payload: { message?: string }) => {
      toast.error(payload?.message ?? "Notification connection rejected");
    };

    socket.on("order:new", handleNewOrder);
    socket.on("order:status_changed", handleStatusChanged);
    socket.on("connection:error", handleConnectionError);

    return () => {
      socket.off("order:new", handleNewOrder);
      socket.off("order:status_changed", handleStatusChanged);
      socket.off("connection:error", handleConnectionError);
    };
  }, [_hasHydrated, isAuthenticated, token, addNotification, router]);
}
