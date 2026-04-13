"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "DB" },
  { href: "/colleges", label: "Colleges", icon: "CL" },
  { href: "/generate-tokens", label: "Generate tokens", icon: "GT" },
  { href: "/requests", label: "Requests", icon: "RQ" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-[250px] bg-[#1e2130] text-[#8e94a8]">
      <div className="flex h-full flex-col py-6">
        <div className="mb-8 px-6">
          <p className="text-[10px] font-bold tracking-[0.15em] text-[#787f96]">SUPER ADMIN</p>
          <h1 className="mt-1 text-xl font-bold text-white">Super Admin</h1>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#252a3b] text-white border-l-4 border-emerald-400 pl-[20px]"
                    : "text-[#8e94a8] hover:bg-[#252a3b]/50 hover:text-white border-l-4 border-transparent pl-[20px]"
                }`}
              >
                <span className={`text-[11px] font-bold ${active ? "text-emerald-400" : "text-[#6b728b]"}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pb-4 pt-4 px-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#252836]/50 transition-colors" onClick={() => void logout()}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b52df] text-xs font-bold text-white shadow-sm">
              SA
            </div>
            <span className="text-[13px] font-semibold text-[#a8afc8]">Super Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
