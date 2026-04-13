"use client";

import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/colleges": "Colleges",
};

const resolveTitle = (pathname: string) => {
  if (pathname.startsWith("/colleges/")) {
    return "College Management";
  }
  return TITLES[pathname] ?? "Super Admin";
};

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-[var(--color-surface)] px-10">
      <h2 className="text-xl font-semibold text-gray-900">{resolveTitle(pathname)}</h2>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-500">{user?.full_name ?? "Super Admin"}</p>
      </div>
    </header>
  );
}
