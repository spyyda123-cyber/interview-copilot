"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FeedbackModal from "../components/FeedbackModal";
import {
  getPendingFeedbacks,
  getAllFeedbacks,
  getStudentApplications,
  type PendingFeedbackItem,
  type FeedbackResponse,
  type ApplicationItem,
} from "@/src/lib/api";

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const C = {
  bg:      "#F5F5F5",
  white:   "#FFFFFF",
  dark:    "#151515",
  accent:  "#D9FF57",
  text:    "#111111",
  muted:   "#7B7B7B",
  border:  "#ECECEC",
  gray:    "#F0F0F0",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getHour() { return new Date().getHours(); }
function greeting(name: string) {
  const h = getHour();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${g}, ${name.split(" ")[0]}`;
}
const fmt = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function getLogoColor(name: string) {
  const colors = ["#1e3a8a","#ea4335","#0ea5e9","#10b981","#8b5cf6","#f59e0b"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ─── Countdown ──────────────────────────────────────────────────────────── */
function Countdown({ dateStr }: { dateStr: string }) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0 });
  useEffect(() => {
    const calc = () => {
      const diff = new Date(dateStr + "T09:00:00").getTime() - Date.now();
      if (diff <= 0) { setT({ d: 0, h: 0, m: 0 }); return; }
      setT({ d: Math.floor(diff/86400000), h: Math.floor((diff%86400000)/3600000), m: Math.floor((diff%3600000)/60000) });
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [dateStr]);

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, margin:"16px 0" }}>
      {[["Days",t.d],["Hours",t.h],["Mins",t.m]].map(([label,val],i) => (
        <div key={label as string} style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:42, fontWeight:800, color:C.white, lineHeight:1, letterSpacing:"-2px" }}>
              {String(val).padStart(2,"0")}
            </div>
            <div style={{ fontSize:9, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:2, marginTop:2 }}>
              {label}
            </div>
          </div>
          {i < 2 && <div style={{ fontSize:32, fontWeight:800, color:C.accent, marginBottom:16 }}>:</div>}
        </div>
      ))}
    </div>
  );
}

/* ─── Stat Card icons ────────────────────────────────────────────────────── */
const StatIcons = {
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  progress: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  feedback: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  cleared: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
};

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon }: { label: string; value: string|number; sub: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: "20px 20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <p style={{ fontSize:12, fontWeight:600, color:C.muted, margin:0, lineHeight:1.4 }}>{label}</p>
        <div style={{ width:32, height:32, borderRadius:8, background:C.gray, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize:40, fontWeight:800, color:C.text, margin:0, lineHeight:1, letterSpacing:"-1px" }}>
        {typeof value === "number" ? String(value).padStart(2,"0") : value}
      </p>
      <p style={{ fontSize:11, color:C.muted, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {sub}
      </p>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number|null>(null);
  const [studentName, setStudentName] = useState("Student");
  const [pending, setPending] = useState<PendingFeedbackItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentPending, setCurrentPending] = useState<PendingFeedbackItem|null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFb, setExpandedFb] = useState<number|null>(null);

  useEffect(() => {
    const sid = sessionStorage.getItem("student_id");
    const name = sessionStorage.getItem("student_name") || "Student";
    if (!sid) { router.replace("/login"); return; }
    setStudentId(Number(sid));
    setStudentName(name);
  }, [router]);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      try {
        const [pRes, fRes, appRes] = await Promise.all([
          getPendingFeedbacks(studentId),
          getAllFeedbacks(studentId),
          getStudentApplications(studentId),
        ]);
        setPending(pRes.pending);
        setFeedbacks(fRes);
        setApplications(appRes.applications || []);
        if (pRes.pending.length > 0) { setCurrentPending(pRes.pending[0]); setShowModal(true); }
      } catch { /* silent */ } finally { setLoading(false); }
    })();
  }, [studentId]);

  const handleSubmitted = useCallback((fb: FeedbackResponse) => {
    setShowModal(false);
    setFeedbacks(prev => [fb, ...prev]);
    setPending(prev => {
      const next = prev.filter(p => !(p.company_name === fb.company_name && p.interview_date === fb.interview_date));
      if (next.length > 0) setTimeout(() => { setCurrentPending(next[0]); setShowModal(true); }, 700);
      return next;
    });
  }, []);

  const processedInterviews = applications
    .filter(a => a.application_status === "ACTIVATED" || a.application_status === "APPROVED")
    .map(a => {
      const dateStr = a.interview_date || new Date().toISOString().split("T")[0];
      const isPast = new Date(dateStr) < new Date();
      return { id: a.application_id, company: a.company_name, role: a.role, date: dateStr, status: isPast ? "completed" : "upcoming", logoColor: getLogoColor(a.company_name) };
    })
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcoming    = processedInterviews.filter(i => i.status === "upcoming");
  const completed   = processedInterviews.filter(i => i.status === "completed");
  const nextInterview = upcoming[0] ?? null;
  const avgRelevance  = feedbacks.length ? (feedbacks.reduce((s,f) => s+f.relevance_score,0)/feedbacks.length).toFixed(1) : null;

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, gap:12 }}>
      <div style={{ width:32, height:32, border:`3px solid ${C.border}`, borderTopColor:C.accent, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <p style={{ fontSize:13, color:C.muted }}>Loading dashboard…</p>
    </div>
  );

  return (
    <div style={{ width:"100%", maxWidth:1100, margin:"0 auto", fontFamily:"'Inter',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:800, color:C.text, margin:0, letterSpacing:"-0.5px" }}>Dashboard</h1>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div
            onClick={() => router.push("/onboarding")}
            style={{ width:36, height:36, borderRadius:"50%", background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:C.dark, cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="scale(1.08)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 4px 12px rgba(217,255,87,0.4)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform="scale(1)"; (e.currentTarget as HTMLDivElement).style.boxShadow="none"; }}
            title="View Profile"
          >
            {studentName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{studentName}</span>
        </div>
      </div>

      {/* ── Top row: 4 stat cards (left) + dark countdown card (right) ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20, marginBottom:20 }}>

        {/* 2x2 Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <StatCard label="Upcoming Interviews" value={upcoming.length} sub={nextInterview ? `Next: ${nextInterview.company} · ${fmt(nextInterview.date)}` : "No upcoming interviews"} icon={StatIcons.calendar} />
          <StatCard label="Study Plan Progress" value="68%" sub="3 topics remaining in Java" icon={StatIcons.progress} />
          <StatCard label="Feedback Pending" value={pending.length} sub={pending.length > 0 ? `Latest: ${pending[0].company_name}` : "All caught up!"} icon={StatIcons.feedback} />
          <StatCard label="Interviews Cleared" value={completed.length} sub={avgRelevance ? `Avg relevance: ${avgRelevance}/5` : "Give feedback for insights"} icon={StatIcons.cleared} />
        </div>

        {/* Dark Next Interview card */}
        <div style={{ background:C.dark, borderRadius:24, padding:"22px 20px" }}>
          <p style={{ fontSize:10, fontWeight:700, color:"#666", textTransform:"uppercase", letterSpacing:2, margin:"0 0 14px" }}>
            Next Interview
          </p>
          {nextInterview ? (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:C.dark, flexShrink:0 }}>
                  {nextInterview.company.charAt(0)}
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:800, color:C.white, margin:0 }}>{nextInterview.company}</p>
                  <p style={{ fontSize:11, color:"#888", margin:0 }}>{fmt(nextInterview.date)}</p>
                </div>
              </div>
              <Countdown dateStr={nextInterview.date} />
              <div style={{ borderTop:"1px solid #2a2a2a", paddingTop:14, marginTop:4 }}>
                <p style={{ fontSize:9, fontWeight:700, color:"#666", textTransform:"uppercase", letterSpacing:2, margin:"0 0 10px" }}>
                  Key Topics to Revise
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {["React","Node.js","System Design"].map(tag => (
                    <span key={tag} style={{ background:C.accent, color:C.dark, fontSize:10, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:10 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:C.accent, opacity:0.2 }} />
              <p style={{ fontSize:12, color:"#666", textAlign:"center" }}>No upcoming interviews</p>
              <button onClick={() => router.push("/target")} style={{ fontSize:11, fontWeight:700, color:C.accent, background:"none", border:"none", cursor:"pointer" }}>
                Browse placements →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: My Interviews (left) + Study Progress (right) — FIXED EQUAL HEIGHT ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20, alignItems:"start" }}>

        {/* My Interviews — fixed height 380px */}
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:20, padding:"22px 22px 18px", height:380, display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <h2 style={{ fontSize:15, fontWeight:800, color:C.text, margin:0 }}>My Interviews</h2>
              <span style={{ background:C.accent, color:C.dark, fontSize:11, fontWeight:800, padding:"2px 9px", borderRadius:20 }}>
                {processedInterviews.length}
              </span>
            </div>
            <button onClick={() => router.push("/interviews")} style={{ fontSize:12, fontWeight:600, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>
              View All
            </button>
          </div>

          {/* Scrollable inner area — max 3 rows, hidden scrollbar */}
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, scrollbarWidth:"none" }}>
            <style>{`.interviews-scroll::-webkit-scrollbar{display:none}`}</style>
            {processedInterviews.length === 0 ? (
              <div style={{ padding:"32px 16px", textAlign:"center", border:`1.5px dashed ${C.border}`, borderRadius:14, background:C.bg, margin:"auto 0" }}>
                <p style={{ fontSize:13, color:C.muted, margin:"0 0 10px" }}>No interviews yet.</p>
                <button onClick={() => router.push("/target")} style={{ fontSize:12, fontWeight:700, color:C.dark, background:C.accent, border:"none", borderRadius:10, padding:"7px 18px", cursor:"pointer" }}>
                  Explore placements →
                </button>
              </div>
            ) : processedInterviews.slice(0, 3).map(iv => {
              const fb = feedbacks.find(f => f.company_name === iv.company);
              const isPast = new Date(iv.date) < new Date();
              const needsFb = isPast && !fb;
              return (
                <div key={iv.id} style={{
                  display:"flex", alignItems:"center", gap:14,
                  background:C.bg, borderRadius:14, padding:"14px 16px",
                  border:`1px solid ${C.border}`,
                  transition:"box-shadow 0.2s, transform 0.2s",
                  flexShrink:0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow="0 4px 16px rgba(0,0,0,0.07)"; (e.currentTarget as HTMLDivElement).style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow="none"; (e.currentTarget as HTMLDivElement).style.transform="none"; }}
                >
                  <div style={{ width:42, height:42, borderRadius:"50%", background:C.dark, display:"flex", alignItems:"center", justifyContent:"center", color:C.accent, fontWeight:800, fontSize:16, flexShrink:0 }}>
                    {iv.company.charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {iv.company} — {iv.role}
                    </p>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>{fmt(iv.date)}</p>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    {needsFb && (
                      <button onClick={() => { setCurrentPending({ company_name:iv.company, role:iv.role, interview_date:iv.date }); setShowModal(true); }}
                        style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20, background:C.accent, color:C.dark, border:"none", cursor:"pointer" }}>
                        + Feedback
                      </button>
                    )}
                    {fb && (
                      <span style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20, background:"transparent", color:C.text, border:`1.5px solid ${C.accent}` }}>
                        Feedback Given
                      </span>
                    )}
                    <span style={{ fontSize:11, fontWeight:700, padding:"4px 14px", borderRadius:20, background: iv.status==="upcoming" ? C.dark : "#E8E8E8", color: iv.status==="upcoming" ? C.accent : C.muted }}>
                      {iv.status === "upcoming" ? "Upcoming" : "Completed"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View All button — only if > 3, pinned to bottom */}
          {processedInterviews.length > 3 && (
            <button onClick={() => router.push("/interviews")}
              style={{ marginTop:12, width:"100%", padding:"9px", borderRadius:10, border:`1px solid ${C.border}`, background:"none", fontSize:12, fontWeight:700, color:C.muted, cursor:"pointer", transition:"all 0.15s", flexShrink:0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background=C.accent; (e.currentTarget as HTMLButtonElement).style.color=C.dark; (e.currentTarget as HTMLButtonElement).style.borderColor=C.accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background="none"; (e.currentTarget as HTMLButtonElement).style.color=C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor=C.border; }}
            >
              View all {processedInterviews.length} interviews →
            </button>
          )}
        </div>

        {/* Study Progress — same fixed height 380px */}
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:20, padding:"20px", height:380, display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexShrink:0 }}>
            <h2 style={{ fontSize:14, fontWeight:800, color:C.text, margin:0 }}>Study Progress</h2>
            <button onClick={() => router.push("/study-plan")} style={{ fontSize:11, fontWeight:600, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>
              Full Plan
            </button>
          </div>

          <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"none" }}>
            {processedInterviews.length === 0 ? (
              <div style={{ padding:"24px 12px", textAlign:"center", border:`1.5px dashed ${C.border}`, borderRadius:12, background:C.bg }}>
                <p style={{ fontSize:12, color:C.muted, margin:"0 0 10px" }}>Activate a study plan to track progress.</p>
                <button onClick={() => router.push("/target")} style={{ fontSize:11, fontWeight:700, color:C.dark, background:C.accent, border:"none", borderRadius:8, padding:"5px 14px", cursor:"pointer" }}>
                  View placements →
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {processedInterviews.slice(0,3).map(iv => (
                  <div key={iv.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:C.text, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%" }}>{iv.company}</p>
                      <p style={{ fontSize:11, color:C.muted, margin:0 }}>{iv.status==="completed"?"100%":"0%"}</p>
                    </div>
                    <div style={{ height:5, background:C.border, borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:99, background: iv.status==="completed" ? C.accent : C.dark, width: iv.status==="completed" ? "100%" : "0%", transition:"width 0.7s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {processedInterviews.length > 3 && (
            <button onClick={() => router.push("/study-plan")}
              style={{ marginTop:12, width:"100%", padding:"8px", borderRadius:10, border:`1px solid ${C.border}`, background:"none", fontSize:11, fontWeight:700, color:C.muted, cursor:"pointer", transition:"all 0.15s", flexShrink:0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background=C.accent; (e.currentTarget as HTMLButtonElement).style.color=C.dark; (e.currentTarget as HTMLButtonElement).style.borderColor=C.accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background="none"; (e.currentTarget as HTMLButtonElement).style.color=C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor=C.border; }}
            >
              View full plan →
            </button>
          )}
        </div>
      </div>

      {/* ── Feedback History — always shown at bottom ── */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:20, padding:"22px", marginTop:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:C.text, margin:0 }}>Feedback History</h2>
            {feedbacks.length > 0 && (
              <span style={{ background:C.bg, color:C.muted, fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, border:`1px solid ${C.border}` }}>
                {feedbacks.length}
              </span>
            )}
          </div>
        </div>

        {feedbacks.length === 0 ? (
          /* Empty state */
          <div style={{ padding:"32px 16px", textAlign:"center", border:`1.5px dashed ${C.border}`, borderRadius:14, background:C.bg }}>
            <div style={{ width:44, height:44, borderRadius:12, background:C.gray, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:"0 0 4px" }}>No feedback submitted yet</p>
            <p style={{ fontSize:12, color:C.muted, margin:0 }}>After attending interviews, share your experience here.</p>
          </div>
        ) : (
          <div>
            {feedbacks.map((fb,idx) => (
              <div key={fb.id} style={{ borderTop: idx>0 ? `1px solid ${C.border}` : "none" }}>
                <button onClick={() => setExpandedFb(expandedFb===fb.id ? null : fb.id)}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 8px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:C.dark, display:"flex", alignItems:"center", justifyContent:"center", color:C.accent, fontWeight:800, fontSize:14, flexShrink:0 }}>
                    {fb.company_name.charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 2px" }}>{fb.company_name} — {fb.role}</p>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>{fmt(fb.interview_date)}</p>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:C.accent, color:C.dark }}>
                      {fb.experience_rating}
                    </span>
                    <span style={{ fontSize:12, color:"#f59e0b", fontWeight:700 }}>
                      {"★".repeat(fb.relevance_score)}<span style={{ color:C.border }}>{"★".repeat(5-fb.relevance_score)}</span>
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
                      style={{ transform: expandedFb===fb.id ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </button>
                {expandedFb===fb.id && (
                  <div style={{ margin:"0 8px 12px", background:C.bg, borderRadius:12, border:`1px solid ${C.border}`, padding:16 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                      {[
                        { label:"Experience", val:fb.experience_rating },
                        { label:"Performance", val:fb.performance_rating },
                        { label:"Course Relevant", val:fb.course_relevance?"Yes ✓":"No ✗" },
                        { label:"Relevance", val:`${fb.relevance_score}/5` },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, margin:"0 0 4px" }}>{label}</p>
                          <span style={{ fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:20, background:C.dark, color:C.accent }}>{val}</span>
                        </div>
                      ))}
                    </div>
                    {fb.out_of_box_questions && (
                      <div style={{ marginBottom:8 }}>
                        <p style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, margin:"0 0 4px" }}>Out-of-scope Questions</p>
                        <p style={{ fontSize:12, color:C.text, background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", margin:0 }}>{fb.out_of_box_questions}</p>
                      </div>
                    )}
                    {fb.additional_notes && (
                      <div>
                        <p style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, margin:"0 0 4px" }}>Notes</p>
                        <p style={{ fontSize:12, color:C.text, background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", margin:0 }}>{fb.additional_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && currentPending && studentId && (
        <FeedbackModal interview={currentPending} studentId={studentId} onClose={() => setShowModal(false)} onSubmitted={handleSubmitted} />
      )}
    </div>
  );
}
