"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/* ─── Inline SVG icons (no external dependency) ─────────────────────────── */
const IconDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IconList = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const IconBook = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const IconLogOut = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const NAV = [
  { label: "Dashboard",      href: "/dashboard",   Icon: IconDashboard },
  { label: "Placements",     href: "/target",       Icon: IconBriefcase },
  { label: "Interview List", href: "/interviews",   Icon: IconList },
  { label: "Study Plan",     href: "/study-plan",   Icon: IconBook },
];
export default function Sidebar() {
  const pathname = usePathname();
  const router  = useRouter();
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    setStudentName(sessionStorage.getItem("student_name") ?? "");
  }, []);

  const handleSignOut = () => {
    [
      "student_id","student_name","student_email","company_name",
      "interview_date","role","target_id","resume_id","primary_skill",
      "known_skills","known_skills_detailed","support_mode","tone",
      "coding_required","jd_text","ats_score","missing_skills",
    ].forEach(k => sessionStorage.removeItem(k));
    router.replace("/login");
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-5 left-5 z-40 p-2 rounded-md bg-white shadow-sm border border-gray-200 text-gray-800"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? '!flex !fixed !inset-y-0 !left-0 !z-50 !w-64' : ''}`}
        style={{
          padding: "28px 0 24px",
          zIndex: 50,
        }}
      >
        {/* ── Brand ── */}
        <div style={{ padding: "0 20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "#D9FF57",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111111", letterSpacing: "-0.3px" }}>
              CoPilot
            </span>
          </div>
          {mobileOpen && (
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <button
                key={href}
                onClick={() => {
                  setMobileOpen(false);
                  router.push(href);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10, border: "none",
                  cursor: "pointer", width: "100%", textAlign: "left",
                  background: active ? "#F1F5F9" : "transparent",
                  color: active ? "#0F172A" : "#64748B",
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { 
                  if (!active) { 
                    (e.currentTarget as HTMLButtonElement).style.background="#F8FAFC"; 
                    (e.currentTarget as HTMLButtonElement).style.color="#0F172A"; 
                  } 
                }}
                onMouseLeave={e => { 
                  if (!active) { 
                    (e.currentTarget as HTMLButtonElement).style.background="transparent"; 
                    (e.currentTarget as HTMLButtonElement).style.color="#64748B"; 
                  } 
                }}
              >
                <div style={{ 
                  width: 7, 
                  height: 7, 
                  borderRadius: "50%", 
                  background: active ? "#D9FF57" : "transparent", 
                  border: active ? "none" : "1.5px solid #94A3B8", 
                  flexShrink: 0, 
                  transition: "all 0.15s" 
                }} />
                <Icon />
                <span>{label}</span>
              </button>
            );
          })}

          {/* Sign Out — directly below Study Plan, separated by a thin line */}
          <div style={{ height: 1, background: "#E2E8F0", margin: "8px 4px" }} />
          <button
            onClick={handleSignOut}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10, border: "none",
              cursor: "pointer", width: "100%", textAlign: "left",
              background: "transparent", color: "#64748B",
              fontSize: 13, fontWeight: 500, transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { 
              (e.currentTarget as HTMLButtonElement).style.background="#FEF2F2"; 
              (e.currentTarget as HTMLButtonElement).style.color="#EF4444"; 
            }}
            onMouseLeave={e => { 
              (e.currentTarget as HTMLButtonElement).style.background="transparent"; 
              (e.currentTarget as HTMLButtonElement).style.color="#64748B"; 
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid #94A3B8", flexShrink: 0 }} />
            <IconLogOut />
            <span>Sign Out</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
