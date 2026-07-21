import { create } from "zustand";

export interface OrderNotification {
  id: string;
  orderId: string;
  orderNumber: string;
  type: "order:new" | "order:status_changed";
  status: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const MAX_NOTIFICATIONS = 50;

interface NotificationState {
  notifications: OrderNotification[];
  unreadCount: number;

  addNotification: (notification: Omit<OrderNotification, "read">) => void;
  clearUnread: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        { ...notification, read: false },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS),
      unreadCount: state.unreadCount + 1,
    })),

  clearUnread: () =>
    set((state) => ({
      unreadCount: 0,
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  reset: () => set({ notifications: [], unreadCount: 0 }),
}));

export const useUnreadCount = () =>
  useNotificationStore((state) => state.unreadCount);

export const useNotifications = () =>
  useNotificationStore((state) => state.notifications);

export const useNotificationActions = () =>
  useNotificationStore((state) => ({
    addNotification: state.addNotification,
    clearUnread: state.clearUnread,
    reset: state.reset,
  }));
