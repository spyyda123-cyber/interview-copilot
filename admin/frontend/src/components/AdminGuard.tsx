"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const isPublicRoute = pathname === "/login" || pathname === "/set-password";

  useEffect(() => {
    if (isPublicRoute) {
      return;
    }

    if (!isAuthenticated || user?.role !== "COLLEGE_ADMIN") {
      router.replace("/login");
    }
  }, [isAuthenticated, isPublicRoute, router, user?.role]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isAuthenticated || user?.role !== "COLLEGE_ADMIN") {
    return null;
  }

  return <>{children}</>;
}
