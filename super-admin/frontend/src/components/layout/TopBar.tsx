"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/colleges": "Colleges",
  "/generate-tokens": "Generate Tokens",
  "/requests": "Requests",
};

const resolveTitle = (pathname: string) => {
  if (pathname.startsWith("/colleges/")) return "College Management";
  return TITLES[pathname] ?? "Super Admin";
};

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const name = user?.full_name ?? "Super Admin";
  const initials = name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#ececec] bg-white px-6">
      <h2 className="text-[15px] font-semibold text-[#222222]">{resolveTitle(pathname)}</h2>
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-[#d9f36e] flex items-center justify-center text-[#222222] text-[10px] font-black">
          {initials}
        </div>
        <span className="text-[13px] font-medium text-[#555555]">{name}</span>
      </div>
    </header>
  );
}
