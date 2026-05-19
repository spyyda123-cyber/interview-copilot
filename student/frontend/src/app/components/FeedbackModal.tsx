"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { submitFeedback, type PendingFeedbackItem, type FeedbackResponse } from "@/src/lib/api";

type Props = {
  interview: PendingFeedbackItem;
  studentId: number;
  onClose: () => void;
  onSubmitted: (fb: FeedbackResponse) => void;
};

const EXP_OPTIONS   = ["Smooth", "Stressful", "Mixed"];
const PERF_OPTIONS  = ["Poor", "Below avg", "Average", "Good", "Excellent"];
const REL_OPTIONS   = ["Not at all", "Partially", "Very relevant"];

export default function FeedbackModal({ interview, studentId, onClose, onSubmitted }: Props) {
  const [mounted, setMounted]       = useState(false);
  const [exp, setExp]               = useState("");
  const [perf, setPerf]             = useState("");
  const [relevance, setRelevance]   = useState("");
  const [score, setScore]           = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [obq, setObq]               = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  /* ── Mount guard (portal needs browser DOM) ── */
  useEffect(() => { setMounted(true); }, []);

  /* ── Lock body scroll while modal is open ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Keyboard close ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  const canSubmit = exp && perf && relevance && score > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitFeedback({
        student_id: studentId,
        company_name: interview.company_name,
        role: interview.role,
        interview_date: interview.interview_date,
        experience_rating: exp,
        performance_rating: perf,
        course_relevance: relevance === "Very relevant",
        relevance_score: score,
        out_of_box_questions: obq.trim() || null,
        additional_notes: null,
      });
      onSubmitted(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initials = interview.company_name
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  /* ── Don't render on server ── */
  if (!mounted) return null;

  const modal = (
    <>
      <style>{`
        @keyframes fmOverlay { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fmSlide   { from { opacity: 0; transform: translateY(20px) scale(0.97) }
                                to   { opacity: 1; transform: translateY(0)    scale(1)    } }
      `}</style>

      {/* ── TRUE full-viewport overlay via portal ── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0, left: "260px",
          width: "calc(100vw - 260px)", height: "100vh",
          background: "rgba(0,0,0,0.50)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          boxSizing: "border-box",
          animation: "fmOverlay 0.2s ease",
        }}
      >
        {/* ── Modal card ── */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "linear-gradient(160deg, #1a1f35 0%, #0f1422 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "680px",
            maxHeight: "88vh",
            overflowY: "auto",
            overflowX: "hidden",
            boxShadow: "0 32px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(99,102,241,0.15)",
            animation: "fmSlide 0.25s ease",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{ padding: "1.4rem 1.5rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#f1f5f9", margin: 0, fontFamily: "var(--font-dm-sans)" }}>
                  Post-interview Feedback
                </h2>
                <p style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                  Auto-triggered · Your response helps refine our AI prep engine
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Company badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "12px", flexShrink: 0 }}>
                  {initials}
                </div>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#e2e8f0" }}>
                  {interview.company_name} — {interview.role}
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                {fmt(interview.interview_date)}
              </span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem", overflowY: "auto" }}>

            <FmQuestion number={1} label="How was the overall interview experience?">
              <FmOptions options={EXP_OPTIONS} selected={exp} onSelect={setExp} />
            </FmQuestion>

            <FmQuestion number={2} label="How did you perform?">
              <FmOptions options={PERF_OPTIONS} selected={perf} onSelect={setPerf} />
            </FmQuestion>

            <FmQuestion number={3} label="Were the courses relevant to what was asked?">
              <FmOptions options={REL_OPTIONS} selected={relevance} onSelect={setRelevance} />
            </FmQuestion>

            <FmQuestion number={4} label="Rate the course relevance (1–5)">
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    onMouseEnter={() => setHoverScore(n)}
                    onMouseLeave={() => setHoverScore(0)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", fontSize: "24px", lineHeight: 1, transition: "transform 0.1s", transform: (hoverScore || score) >= n ? "scale(1.2)" : "scale(1)" }}
                  >
                    <span style={{ color: (hoverScore || score) >= n ? "#fbbf24" : "#2d3748" }}>★</span>
                  </button>
                ))}
                {score > 0 && <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginLeft: "6px" }}>{score} / 5</span>}
              </div>
            </FmQuestion>

            <FmQuestion number={5} label="Questions NOT covered in the courses?">
              <textarea
                value={obq}
                onChange={(e) => setObq(e.target.value)}
                placeholder="e.g. distributed caching, system design for scale..."
                rows={3}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px", padding: "10px 12px", color: "#e2e8f0", fontSize: "12.5px", fontFamily: "var(--font-inter)", resize: "vertical", outline: "none", marginTop: "4px", boxSizing: "border-box" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(99,102,241,0.55)"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.10)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
              />
            </FmQuestion>

            {error && (
              <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#fca5a5" }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: "11px", color: "#475569" }}>Helps improve AI recommendations for future students</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button onClick={onClose} style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "8px 12px" }}>
                Skip for now
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                style={{ fontSize: "13px", fontWeight: 700, color: "#fff", background: canSubmit && !submitting ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(99,102,241,0.3)", border: "none", borderRadius: "10px", padding: "9px 20px", cursor: canSubmit && !submitting ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "6px", opacity: !canSubmit || submitting ? 0.6 : 1, transition: "opacity 0.15s" }}
              >
                {submitting && (
                  <span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
                )}
                {submitting ? "Submitting…" : "Submit feedback →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  /* ── Render into document.body via portal ── */
  return createPortal(modal, document.body);
}

/* ─────────── Sub-components ─────────── */
function FmQuestion({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#818cf8", flexShrink: 0 }}>
          {number}
        </div>
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function FmOptions({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {options.map((opt) => {
        const sel = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            style={{ flex: 1, minWidth: "72px", padding: "8px 10px", borderRadius: "8px", border: sel ? "1.5px solid #6366f1" : "1px solid rgba(255,255,255,0.09)", background: sel ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.03)", color: sel ? "#a5b4fc" : "#64748b", fontWeight: sel ? 700 : 500, fontSize: "12px", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-inter)" }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
