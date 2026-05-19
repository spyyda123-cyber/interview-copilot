"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getHealth } from "@/src/lib/api";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/onboarding": { title: "Profile Setup", subtitle: "Configure your interview preferences" },
  "/target": { title: "Target Analysis", subtitle: "Analyze job description requirements" },
  "/resume": { title: "Resume Review", subtitle: "Upload and compare your resume" },
  "/plan": { title: "Study Plan", subtitle: "Your personalized prep schedule" },
  "/study-plan": { title: "Study Plan", subtitle: "" },
  "/prep": { title: "Study Plan", subtitle: "Your personalized prep schedule" },
  "/analysis": { title: "Processing", subtitle: "Analyzing your profile" },
  "/status": { title: "System Status", subtitle: "Backend service health" },
  "/company": { title: "Company Intel", subtitle: "Research on your target" },
  "/dashboard": { title: "Dashboard", subtitle: "Your interview overview and feedback" },
};

export default function TopBar() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<"ok" | "down" | "checking">("checking");
  const [interviewDate, setInterviewDate] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  const pageInfo = PAGE_TITLES[pathname] ?? { title: "Dashboard", subtitle: "Interview preparation hub" };

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const r = await getHealth();
        if (mounted) setApiStatus(r.status === "ok" ? "ok" : "down");
      } catch {
        if (mounted) setApiStatus("down");
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const date = sessionStorage.getItem("interview_date");
    if (date) {
      setInterviewDate(date);
      const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
      setDaysLeft(diff > 0 ? diff : 0);
    }
  }, []);

  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <h1 style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[17px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
          {pageInfo.title}
        </h1>
        {pathname === "/study-plan" ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest"
            style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3b82f6' }} /> Active
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{pageInfo.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {pathname === "/study-plan" && (
          <div className="hidden sm:block text-[12px] font-medium text-[var(--text-muted)] mr-2">
            Expires: <span className="text-[var(--text-primary)]">Mar 25, 2026</span>
          </div>
        )}
        {daysLeft !== null && (
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="text-[11px] font-bold text-amber-800">{daysLeft}d remaining</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 rounded-md bg-[var(--bg-muted)] px-2.5 py-1.5">
          <span className={`inline-block h-[7px] w-[7px] rounded-full ${
            apiStatus === "ok" ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" :
            apiStatus === "down" ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]" : "bg-gray-400"
          }`} />
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {apiStatus === "ok" ? "Connected" : apiStatus === "down" ? "Offline" : "Checking"}
          </span>
        </div>
      </div>
    </header>
  );
}
