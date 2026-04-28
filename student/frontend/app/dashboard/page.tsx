"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FeedbackModal from "../components/FeedbackModal";
import { getPendingFeedbacks, getAllFeedbacks, type PendingFeedbackItem, type FeedbackResponse } from "@/src/lib/api";

const MOCK_INTERVIEWS = [
  { id: 1, company: "TCS Digital", role: "Java Backend Developer", date: "2026-03-25", status: "completed", logoColor: "#1e3a8a", skills: ["Java", "SQL"] },
  { id: 2, company: "Google", role: "SDE Intern", date: "2026-04-02", status: "completed", logoColor: "#ea4335", skills: ["DSA", "System Design"] },
  { id: 3, company: "Infosys SP", role: "Systems Engineer", date: "2026-05-05", status: "upcoming", logoColor: "#0ea5e9", skills: ["React", "Node.js"] },
];

const MOCK_STUDY = [
  { topic: "Java Fundamentals", pct: 85 },
  { topic: "Data Structures & Algo", pct: 72 },
  { topic: "React + Node.js", pct: 55 },
  { topic: "System Design", pct: 40 },
];

function getHour() { return new Date().getHours(); }
function greeting(name: string) {
  const h = getHour();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${g}, ${name.split(" ")[0]}`;
}

function Countdown({ dateStr }: { dateStr: string }) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0 });
  useEffect(() => {
    const calc = () => {
      const diff = new Date(dateStr + "T09:00:00").getTime() - Date.now();
      if (diff <= 0) { setT({ d: 0, h: 0, m: 0 }); return; }
      setT({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000) });
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [dateStr]);
  return (
    <div className="flex gap-2 mt-3">
      {[["d", t.d], ["h", t.h], ["m", t.m]].map(([label, val]) => (
        <div key={label as string} className="flex-1 rounded-lg bg-[var(--accent-subtle)] border border-[var(--border)] py-2 text-center">
          <p className="text-xl font-bold text-[var(--accent)] leading-tight">{String(val).padStart(2, "0")}</p>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState("Student");
  const [pending, setPending] = useState<PendingFeedbackItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentPending, setCurrentPending] = useState<PendingFeedbackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [expandedFb, setExpandedFb] = useState<number | null>(null);

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
        const [pRes, fRes] = await Promise.all([getPendingFeedbacks(studentId), getAllFeedbacks(studentId)]);
        setPending(pRes.pending);
        setFeedbacks(fRes);
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

  const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const upcoming = MOCK_INTERVIEWS.filter(i => i.status === "upcoming");
  const completed = MOCK_INTERVIEWS.filter(i => i.status === "completed");
  const nextInterview = upcoming[0] ?? null;
  const avgRelevance = feedbacks.length ? (feedbacks.reduce((s, f) => s + f.relevance_score, 0) / feedbacks.length).toFixed(1) : null;

  const expColor = (r: string) => ({ Excellent: "text-emerald-600 bg-emerald-50 border-emerald-200", Good: "text-blue-600 bg-blue-50 border-blue-200", Average: "text-amber-600 bg-amber-50 border-amber-200", Poor: "text-red-600 bg-red-50 border-red-200" }[r] ?? "text-slate-600 bg-slate-50 border-slate-200");
  const perfColor = (r: string) => ({ "Very Well": "text-emerald-600 bg-emerald-50 border-emerald-200", Well: "text-sky-600 bg-sky-50 border-sky-200", Average: "text-amber-600 bg-amber-50 border-amber-200", "Below Average": "text-red-600 bg-red-50 border-red-200" }[r] ?? "text-slate-600 bg-slate-50 border-slate-200");

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-2 border-[var(--accent-subtle)] border-t-[var(--accent)] rounded-full animate-spin" />
      <p className="text-sm text-[var(--text-muted)]">Loading dashboard…</p>
    </div>
  );

  return (
    <div className="animate-fade-in w-full max-w-6xl mx-auto py-2 space-y-5">

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] leading-tight" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {greeting(studentName)} — <span className="text-[var(--accent)]">placement season is live</span> 🎯
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            {upcoming.length} upcoming interview{upcoming.length !== 1 ? "s" : ""} · {completed.length} completed · {pending.length} feedback{pending.length !== 1 ? "s" : ""} pending
          </p>
        </div>
        <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--accent)]/20">
          Placement season active
        </div>
      </div>

      {/* ── Feedback pending banner ── */}
      {pending.length > 0 && !bannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900 truncate">
                Interview feedback pending — {pending[0].company_name}
              </p>
              <p className="text-xs text-amber-700/80">
                You interviewed on {fmt(pending[0].interview_date)} · Share your experience to refine AI prep for future students.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => { setCurrentPending(pending[0]); setShowModal(true); }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition whitespace-nowrap">
              Give feedback →
            </button>
            <button onClick={() => setBannerDismissed(true)} className="text-amber-400 hover:text-amber-600 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── 4 Stat cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Upcoming Interviews", value: upcoming.length, sub: nextInterview ? `Next: ${nextInterview.company} · ${fmt(nextInterview.date)}` : "No upcoming", color: "#6366f1", bg: "#eef2ff", icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/> },
          { label: "Study Plan Progress", value: "68%", sub: "3 topics remaining in Java", color: "#10b981", bg: "#ecfdf5", icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
          { label: "Feedback Pending", value: pending.length, sub: pending.length > 0 ? `Latest: ${pending[0].company_name}` : "All caught up!", color: "#f59e0b", bg: "#fffbeb", icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
          { label: "Interviews Cleared", value: completed.length, sub: avgRelevance ? `Avg relevance: ${avgRelevance}/5` : "Give feedback for insights", color: "#0ea5e9", bg: "#e0f2fe", icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></> },
        ].map(({ label, value, sub, color, bg, icon }) => (
          <div key={label} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            </div>
            <p className="text-[28px] font-bold leading-tight" style={{ color }}>{value}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column section ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* My Interviews – 2 cols */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
              My Interviews
              <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">{MOCK_INTERVIEWS.length}</span>
            </h2>
            <button className="text-[12px] font-semibold text-[var(--accent)] hover:underline" onClick={() => router.push("/interviews")}>View all →</button>
          </div>
          <div className="space-y-3">
            {MOCK_INTERVIEWS.map(iv => {
              const fb = feedbacks.find(f => f.company_name === iv.company);
              const isPast = new Date(iv.date) < new Date();
              const needsFb = isPast && !fb;
              return (
                <div key={iv.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-3 hover:bg-[var(--bg-muted)] transition">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: iv.logoColor }}>
                    {iv.company.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{iv.company} — {iv.role}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--text-muted)]">{fmt(iv.date)}</span>
                      {iv.skills.map(s => <span key={s} className="skill-tag text-[10px] px-1.5 py-0">{s}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {needsFb && (
                      <button onClick={() => { setCurrentPending({ company_name: iv.company, role: iv.role, interview_date: iv.date }); setShowModal(true); }}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition">
                        + Add feedback
                      </button>
                    )}
                    {fb && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Feedback given ✓
                      </span>
                    )}
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${iv.status === "upcoming" ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] border-[var(--accent)]/20" : "bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border)]"}`}>
                      {iv.status === "upcoming" ? "Upcoming" : "Completed"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Next interview countdown */}
          {nextInterview && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-dm-sans)" }}>Next Interview</h3>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: nextInterview.logoColor }}>{nextInterview.company.charAt(0)}</div>
                <div>
                  <p className="text-[12px] font-bold text-[var(--text-primary)]">{nextInterview.company}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{fmt(nextInterview.date)}</p>
                </div>
              </div>
              <Countdown dateStr={nextInterview.date} />
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Key topics to revise</p>
                <div className="flex flex-wrap gap-1.5">
                  {nextInterview.skills.map(s => <span key={s} className="skill-tag text-[10px]">{s}</span>)}
                  <span className="skill-tag skill-tag-teal text-[10px]">System Design</span>
                </div>
              </div>
            </div>
          )}

          {/* Study Progress */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-dm-sans)" }}>Study Progress</h3>
              <button className="text-[11px] font-semibold text-[var(--accent)] hover:underline" onClick={() => router.push("/study-plan")}>Full plan →</button>
            </div>
            <div className="space-y-3">
              {MOCK_STUDY.map(({ topic, pct }) => {
                const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#6366f1" : pct >= 40 ? "#f59e0b" : "#f43f5e";
                return (
                  <div key={topic}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{topic}</span>
                      <span className="text-[11px] font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <ProgressBar pct={pct} color={color} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Feedback History ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Feedback History
            {feedbacks.length > 0 && <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">{feedbacks.length}</span>}
          </h2>
        </div>

        {feedbacks.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">No feedback submitted yet</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">After attending interviews, share your experience here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {feedbacks.map(fb => (
              <div key={fb.id}>
                <button
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-[var(--bg-muted)]/50 transition rounded-lg px-2 -mx-2"
                  onClick={() => setExpandedFb(expandedFb === fb.id ? null : fb.id)}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: "var(--accent)" }}>{fb.company_name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--text-primary)]">{fb.company_name} — {fb.role}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{fmt(fb.interview_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${expColor(fb.experience_rating)}`}>{fb.experience_rating}</span>
                    <span className="text-amber-400 text-xs font-bold">{"★".repeat(fb.relevance_score)}<span className="text-[var(--border)]">{"★".repeat(5 - fb.relevance_score)}</span></span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${expandedFb === fb.id ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>

                {expandedFb === fb.id && (
                  <div className="mx-2 mb-3 rounded-xl bg-[var(--bg-muted)]/60 border border-[var(--border)] p-4 animate-fade-in">
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      {[
                        { label: "Experience", val: <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${expColor(fb.experience_rating)}`}>{fb.experience_rating}</span> },
                        { label: "Performance", val: <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${perfColor(fb.performance_rating)}`}>{fb.performance_rating}</span> },
                        { label: "Courses Relatable", val: <span className={`text-[12px] font-bold ${fb.course_relevance ? "text-emerald-600" : "text-red-500"}`}>{fb.course_relevance ? "✅ Yes" : "❌ No"}</span> },
                        { label: "Relevance", val: <span className="text-amber-500 text-sm font-bold">{"★".repeat(fb.relevance_score)}<span className="text-slate-300">{"★".repeat(5 - fb.relevance_score)}</span></span> },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1">{label}</p>
                          {val}
                        </div>
                      ))}
                    </div>
                    {fb.out_of_box_questions && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1">Out-of-scope Questions</p>
                        <p className="text-[12px] text-[var(--text-secondary)] bg-white border border-[var(--border)] rounded-lg px-3 py-2 leading-relaxed">{fb.out_of_box_questions}</p>
                      </div>
                    )}
                    {fb.additional_notes && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1">Notes</p>
                        <p className="text-[12px] text-[var(--text-secondary)] bg-white border border-[var(--border)] rounded-lg px-3 py-2 leading-relaxed">{fb.additional_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {showModal && currentPending && studentId && (
        <FeedbackModal interview={currentPending} studentId={studentId} onClose={() => setShowModal(false)} onSubmitted={handleSubmitted} />
      )}
    </div>
  );
}
