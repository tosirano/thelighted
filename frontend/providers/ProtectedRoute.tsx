"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthRehydrated } from "@/lib/store/authStore";

function SkeletonLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="w-full max-w-md p-8 space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const hasHydrated = useAuthRehydrated();
  const { isAuthenticated, isLoading } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
  }));

  useEffect(() => {
    if (hasHydrated && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [hasHydrated, isLoading, isAuthenticated, router]);

  if (!hasHydrated || isLoading) {
    return <SkeletonLoader />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
