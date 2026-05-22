"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

export default function SuperAdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

  const isPublicRoute = pathname === "/login";

  useEffect(() => {
    if (isLoading || isPublicRoute) {
      return;
    }

    if (!isAuthenticated || user?.role !== "SUPER_ADMIN") {
      router.replace("/login");
    }
  }, [isAuthenticated, isPublicRoute, router, user?.role, isLoading]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600/80 border-t-transparent shadow-sm"></div>
          <span className="text-sm font-semibold tracking-wide text-slate-500">Initializing Super Admin Console...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "SUPER_ADMIN") {
    return null;
  }

  return <>{children}</>;
}
