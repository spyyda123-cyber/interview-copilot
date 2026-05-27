"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const titleMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/student-db": "Student DB",
  "/companies": "Companies",
  "/approvals": "Approvals",
  "/tokens": "Token Pool",
  "/readiness": "Readiness",
  "/reports": "Reports",
};

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const title = Object.entries(titleMap).find(
    ([key]) => pathname === key || pathname.startsWith(`${key}/`)
  )?.[1] ?? "Admin";

  const initials = "A";

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#ececec] bg-white px-6">
      <h1 className="text-[15px] font-semibold text-[#222222]">{title}</h1>
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-[#d9f36e] flex items-center justify-center text-[#222222] text-[10px] font-black">
          {initials}
        </div>
        <span className="text-[13px] font-medium text-[#555555]">Admin</span>
      </div>
    </header>
  );
}
