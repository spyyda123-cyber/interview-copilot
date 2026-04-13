"use client";

import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

const titleMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/students": "Students",
  "/student-db": "Student DB",
  "/companies": "Companies",
  "/approvals": "Approvals",
  "/tokens": "Token pool",
};

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const title = Object.entries(titleMap).find(([key]) => pathname === key || pathname.startsWith(`${key}/`))?.[1] ?? "Admin";

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#f3f4f6] bg-white px-8">
      <h1 className="text-lg font-semibold text-[#111827]">{title}</h1>
      <div className="text-right">
        <p className="text-sm font-medium text-[#6b7280]">College Admin</p>
      </div>
    </header>
  );
}
