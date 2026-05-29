"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import Sidebar from "@/components/layout/Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/set-password";

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex bg-[#f3f3f3] min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 ml-[220px]">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
