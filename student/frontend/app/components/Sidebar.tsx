"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  {
    section: "Preparation",
    items: [
      {
        label: "Profile Setup",
        href: "/onboarding",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ),
        color: "#818cf8",
        step: 1,
      },
      {
        label: "Target Analysis",
        href: "/target",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        ),
        color: "#38bdf8",
        step: 2,
      },
      {
        label: "Resume Review",
        href: "/resume",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        ),
        color: "#34d399",
        step: 3,
      },
      {
        label: "Study Plan",
        href: "/plan",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        ),
        color: "#fbbf24",
        step: 4,
      },
    ],
  },
  {
    section: "System",
    items: [
      {
        label: "System Status",
        href: "/status",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        ),
        color: "#94a3b8",
        step: 0,
      },
    ],
  },
];

const ONBOARDING_NAV_ITEMS = [
  {
    section: "PREPARATION",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <div className="flex items-center justify-center w-[18px] h-[18px] bg-[#2E3C4D] text-[#818cf8] font-bold text-[9px] rounded-sm">DB</div>
        ),
        color: "#818cf8",
      },
      {
        label: "Profile",
        href: "/onboarding",
        icon: (
          <div className="flex items-center justify-center w-[18px] h-[18px] bg-[#2E3C4D] text-[#34d399] font-bold text-[9px] rounded-sm">PS</div>
        ),
        color: "#34d399",
      },
      {
        label: "Placements",
        href: "/target",
        icon: (
          <div className="flex items-center justify-center w-[18px] h-[18px] bg-[#2E3C4D] text-white font-bold text-[9px] rounded-sm">PL</div>
        ),
        color: "#ffffff",
      },
      {
        label: "Interview list",
        href: "/interviews",
        icon: (
          <div className="flex items-center justify-center w-[18px] h-[18px] bg-[#2E3C4D] text-slate-500 font-bold text-[9px] rounded-sm">IL</div>
        ),
        color: "#64748b",
      },
      {
        label: "Study plan",
        href: "/study-plan", // Different from /plan to avoid clash or just disabled
        icon: (
          <div className="flex items-center justify-center w-[18px] h-[18px] bg-[#2E3C4D] text-slate-500 font-bold text-[9px] rounded-sm">SP</div>
        ),
        color: "#64748b",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    setCompanyName(sessionStorage.getItem("company_name") ?? "");
    setStudentName(sessionStorage.getItem("student_name") ?? "");
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "S";
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const handleResetSession = () => {
    const keysToClear = [
      "student_id", "student_name", "student_email",
      "company_name", "interview_date", "role", "target_id", "resume_id",
      "primary_skill", "known_skills", "support_mode", "tone",
      "coding_required", "jd_text",
    ];
    keysToClear.forEach((key) => sessionStorage.removeItem(key));
    router.replace("/login");
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-white leading-tight tracking-tight">Interview Copilot</p>
          <p className="text-[10px] font-medium text-indigo-300/70 uppercase tracking-widest">Prep Studio</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {(pathname.startsWith("/onboarding") || pathname.startsWith("/target") || pathname.startsWith("/interviews") || pathname.startsWith("/study-plan") || pathname.startsWith("/resume") || pathname.startsWith("/dashboard")) ? (
          ONBOARDING_NAV_ITEMS.map((section) => (
            <div key={section.section}>
              <p className="sidebar-section-label tracking-widest text-[10px] text-slate-500 font-bold mb-4">{section.section}</p>
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                  >
                    <span className="sidebar-link-icon" style={isActive ? { color: item.color, opacity: 1 } : undefined}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))
        ) : (
          NAV_ITEMS.map((section) => (
            <div key={section.section}>
              <p className="sidebar-section-label">{section.section}</p>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                  >
                    <span className="sidebar-link-icon" style={isActive ? { color: item.color, opacity: 1 } : undefined}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </nav>

      {/* Footer profile */}
      <div className="sidebar-footer">
        {companyName && (
          <div className="mb-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-400/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-indigo-300/60 uppercase tracking-wider mb-0.5">Preparing for</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-white truncate">{companyName}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white shadow-sm">
              {getInitials(studentName)}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-slate-200 truncate">{studentName || "Student"}</p>
            </div>
          </div>
          <button
            onClick={handleResetSession}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/8 hover:text-slate-300"
            title="Sign out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
