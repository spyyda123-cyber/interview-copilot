"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="bg-[#f3f3f3] min-h-screen">
      <Sidebar />
      <div className="ml-[220px] min-w-0">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
