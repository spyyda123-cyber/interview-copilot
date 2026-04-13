"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

export default function SuperAdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const isPublicRoute = pathname === "/login";

  useEffect(() => {
    if (isPublicRoute) {
      return;
    }

    if (!isAuthenticated || user?.role !== "SUPER_ADMIN") {
      router.replace("/login");
    }
  }, [isAuthenticated, isPublicRoute, router, user?.role]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isAuthenticated || user?.role !== "SUPER_ADMIN") {
    return null;
  }

  return <>{children}</>;
}
