"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "DB" },
  { href: "/student-db", label: "Student DB", icon: "SD" },
  { href: "/companies", label: "Companies", icon: "CP" },
  { href: "/approvals", label: "Approvals", icon: "AP" },
  { href: "/tokens", label: "Token pool", icon: "TK" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sticky top-0 h-screen w-64 border-r border-[#f0f0f0] bg-[#fcfcfc] px-4 py-8 flex flex-col">
      <div className="px-2">
        <p className="text-[10px] font-medium tracking-[0.25em] text-[#9ca3af] uppercase">SPYYDA</p>
        <h2 className="mt-1 text-2xl font-bold text-[#111827]">College Admin</h2>
      </div>

      <nav className="mt-10 space-y-1 flex-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-[#ecfdf5] text-[#059669] shadow-[0_1px_2px_rgba(16,185,129,0.05)] border-l-2 border-[#10b981] pl-[10px]"
                  : "text-[#6b7280] hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent pl-[10px]"
              }`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold ${active ? "border-[#10b981] bg-[#10b981] text-white" : "border-gray-200 bg-white"}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="flex items-center gap-3 px-2 py-4 mb-2 border-t border-gray-100">
          <div className="h-8 w-8 rounded-full bg-[#374151] flex items-center justify-center text-white text-[10px] font-bold">A</div>
          <span className="text-[13px] font-semibold text-[#374151]">Admin</span>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
