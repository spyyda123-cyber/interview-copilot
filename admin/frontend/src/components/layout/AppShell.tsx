"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/set-password";

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-surface-secondary)]">
      <Sidebar />
      <div className="flex-1">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
