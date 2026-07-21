"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ShoppingBag, LogOut } from "lucide-react";
import { useAuthActions } from "@/lib/store/authStore";
import { useNotificationActions, useUnreadCount } from "@/lib/store/notificationStore";
import { disconnectSocket } from "@/lib/socket/socketClient";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const unreadCount = useUnreadCount();
  const { clearAuth } = useAuthActions();
  const { reset: resetNotifications } = useNotificationActions();

  function handleLogout() {
    disconnectSocket();
    resetNotifications();
    clearAuth();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-white">
      <nav className="flex-1 space-y-1 p-3" aria-label="Admin navigation">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </span>
              {label === "Orders" && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread orders`}
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}
