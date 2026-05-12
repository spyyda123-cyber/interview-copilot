"use client";

import dynamic from "next/dynamic";
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "100%", background: "#f3f3f3", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#888888", fontSize: 12 }}>Loading editor…</span>
      </div>
    ),
  }
);

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FeedbackModal from "../components/FeedbackModal";
import {
  generatePrep,
  getLatestPrep,
  getPrepStatus,
  resetPrepPlan,
  type PlanDetailResponse,
  type DailyPlanItem,
  type LearningTask,
} from "@/src/lib/api";

/* ─────────────────────────────────────────────────────────────────────────────
 *  GLOBAL STYLES
 * ───────────────────────────────────────────────────────────────────────────── */
const globalStyles = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .sp-fade-up { animation: fadeInUp 0.35s ease both; }
  .sp-scroll::-webkit-scrollbar { width: 4px; }
  .sp-scroll::-webkit-scrollbar-track { background: transparent; }
  .sp-scroll::-webkit-scrollbar-thumb { background: #d9f36e; border-radius: 10px; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
 *  DESIGN TOKENS  — lime / black / white theme
 *  #d9f36e  lime accent
 *  #222222  near-black text & dark elements
 *  #ffffff  white cards
 *  #f3f3f3  light gray background
 * ───────────────────────────────────────────────────────────────────────────── */
const C = {
  bg:          "#f3f3f3",
  surface:     "#f3f3f3",
  card:        "#ffffff",
  cardHover:   "#f9f9f9",
  border:      "#e8e8e8",
  borderLight: "#ececec",
  purple:      "#222222",       // primary action color → near-black
  purpleLight: "#444444",       // secondary text
  purpleDim:   "#f0f0f0",       // subtle bg for highlighted areas
  purpleBg:    "#f5f5f5",       // section backgrounds
  green:       "#222222",       // success → use dark
  greenBg:     "#edffd6",       // lime-tinted bg
  greenLight:  "#d9f36e",       // lime accent
  amber:       "#555555",
  amberBg:     "#f5f5f5",
  red:         "#cc3333",
  blue:        "#222222",
  blueBg:      "#f3f3f3",
  text:        "#222222",
  textMuted:   "#555555",
  textDim:     "#888888",
  white:       "#ffffff",
  // Lime-specific tokens
  lime:        "#d9f36e",
  limeDark:    "#b8d44a",
  limeBg:      "#f7ffe0",
};

/* ─────────────────────────────────────────────────────────────────────────────
 *  SVG ICONS
 * ───────────────────────────────────────────────────────────────────────────── */
const Ico = {
  check: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  lock: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  arrowRight: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  arrowLeft: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  play: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  code: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  book: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  clock: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  lightbulb: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14" />
    </svg>
  ),
  x: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  refresh: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  terminal: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  zap: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  star: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  chevronDown: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────────────────────────────────────
 *  SMALL REUSABLE COMPONENTS
 * ───────────────────────────────────────────────────────────────────────────── */
function Badge({ label, color = C.purple, bg = C.purpleDim }: { label: string; color?: string; bg?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: bg, color, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
      {label}
    </span>
  );
}

function ProgressBar({ pct, color = C.purple, height = 4 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{ height, background: C.border, borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  );
}

function Breadcrumb({ items, onNavigate }: { items: { label: string; screen?: string }[]; onNavigate: (s: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: C.textDim, fontSize: 12 }}>/</span>}
          <span
            onClick={() => item.screen && onNavigate(item.screen)}
            style={{
              fontSize: 12, color: item.screen ? C.purpleLight : C.textMuted,
              cursor: item.screen ? "pointer" : "default",
              fontWeight: item.screen ? 600 : 400,
            }}
          >
            {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 0 — FOUNDATION (Phase 1 & 2 Detail)
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen0Foundation({
  company,
  role,
  dynamicPlan,
  initialTab,
  onNavigate,
}: {
  company: string;
  role: string;
  dynamicPlan: PlanDetailResponse | null;
  initialTab: "overview" | "topics" | "gaps" | "quiz";
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "topics" | "gaps" | "quiz">(initialTab);

  const foundationTopics = [
    { title: "Arrays & Strings", mastery: 100, time: "45min" },
    { title: "Linked Lists", mastery: 95, time: "40min" },
    { title: "Stacks & Queues", mastery: 90, time: "35min" },
    { title: "Hash Tables", mastery: 100, time: "50min" },
    { title: "Trees & Graphs", mastery: 85, time: "60min" },
    { title: "Sorting & Searching", mastery: 95, time: "45min" },
  ];

  const gaps = [
    { skill: "Concurrency & Multithreading", severity: "high", inCourse: true, reason: "Required for backend role, currently at beginner level" },
    { skill: "Low-Level Design (LLD)", severity: "high", inCourse: true, reason: "Critical for L5+ roles, missing SOLID principles depth" },
    { skill: "System Design Patterns", severity: "medium", inCourse: true, reason: "Intermediate level, needs advanced patterns" },
    { skill: "Distributed Systems", severity: "medium", inCourse: false, reason: "Not covered in course, required by JD" },
  ];

  const foundationQuizQuestions = [
    {
      question: "What is the time complexity of searching in a balanced Binary Search Tree?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correct_index: 1,
      explanation: "A balanced BST has height O(log n), so search, insert, and delete all run in O(log n). An unbalanced BST degrades to O(n) in the worst case.",
    },
    {
      question: "Which data structure uses LIFO (Last In, First Out) ordering?",
      options: ["Queue", "Stack", "Linked List", "Hash Table"],
      correct_index: 1,
      explanation: "A Stack follows LIFO — the last element pushed is the first to be popped. Queues use FIFO (First In, First Out).",
    },
    {
      question: "What is the average time complexity of insertion in a Hash Table?",
      options: ["O(n)", "O(log n)", "O(1)", "O(n\u00b2)"],
      correct_index: 2,
      explanation: "Hash tables provide O(1) average-case insertion, lookup, and deletion. Worst case is O(n) due to hash collisions, but a good hash function keeps this rare.",
    },
    {
      question: "In a graph with V vertices and E edges, what is the space complexity of an adjacency list?",
      options: ["O(V)", "O(E)", "O(V + E)", "O(V \u00d7 E)"],
      correct_index: 2,
      explanation: "An adjacency list stores each vertex once (O(V)) and each edge once or twice for undirected graphs (O(E)), giving total space O(V + E). More efficient than adjacency matrix O(V\u00b2) for sparse graphs.",
    },
    {
      question: "Which sorting algorithm guarantees O(n log n) in all cases?",
      options: ["Quick Sort", "Merge Sort", "Bubble Sort", "Insertion Sort"],
      correct_index: 1,
      explanation: "Merge Sort guarantees O(n log n) in best, average, and worst cases. Quick Sort averages O(n log n) but has O(n\u00b2) worst case. Merge Sort is preferred when worst-case guarantees matter.",
    },
  ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <button
            onClick={() => onNavigate("plan")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              borderRadius: 8, background: "none", border: `1px solid ${C.border}`,
              color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 10,
            }}
          >
            {Ico.arrowLeft(12)} Back to Plan
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight }}>{company}</span>
            <span style={{ color: C.textDim }}>•</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>{role}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>Foundation & Gap Analysis</h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Phase 1 & 2 — Core algorithms mastered, skill gaps identified</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Badge label="Phase 1 \u2713" color={C.greenLight} bg={C.greenBg} />
            <Badge label="Phase 2 \u2713" color={C.greenLight} bg={C.greenBg} />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.purpleLight, lineHeight: 1 }}>94%</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Avg Mastery</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: C.surface, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {([
          { key: "overview", label: "Overview" },
          { key: "topics",   label: "Foundation Topics" },
          { key: "gaps",     label: "Gap Analysis" },
          { key: "quiz",     label: "Foundation Quiz" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: activeTab === t.key ? C.purple : "none",
              color: activeTab === t.key ? C.white : C.textMuted,
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === "overview" && (
        <div className="sp-fade-up">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Ico.check(16, C.greenLight)}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>Foundation Complete</h3>
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
                All 6 core DSA topics mastered. Average mastery 94%. Ready for advanced interview prep.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Badge label="6 Topics" color={C.purpleLight} bg={C.purpleDim} />
                <Badge label="94% Avg" color={C.greenLight} bg={C.greenBg} />
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Ico.zap(16)}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>Gaps Identified</h3>
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
                4 critical gaps found for {role}. 2 high-priority gaps addressed first in Phase 3.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Badge label="2 High" color={C.red} bg="rgba(220,38,38,0.1)" />
                <Badge label="2 Medium" color={C.amber} bg={C.amberBg} />
              </div>
            </div>
          </div>

          {/* Journey timeline */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 26px", marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 20px" }}>Your Foundation Journey</h3>
            <div style={{ position: "relative" as const }}>
              <div style={{ position: "absolute" as const, left: 19, top: 20, bottom: 20, width: 2, background: C.greenLight, borderRadius: 2 }} />
              {[
                { label: "Phase 1: Foundation", detail: "Mastered Arrays, Linked Lists, Trees, Graphs, Sorting, Searching", badge: "100% Complete" },
                { label: "Phase 2: Gap Analysis", detail: "Identified 4 critical gaps: Concurrency, LLD, System Design, Distributed Systems", badge: "Complete" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, marginBottom: i === 0 ? 24 : 0, position: "relative" as const }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.greenBg, border: `2px solid ${C.greenLight}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, flexShrink: 0 }}>
                    {Ico.check(16, C.greenLight)}
                  </div>
                  <div style={{ flex: 1, paddingTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{item.label}</span>
                      <Badge label={item.badge} color={C.greenLight} bg={C.greenBg} />
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ background: "linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)", border: `1px solid #d9f36e`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {Ico.arrowRight(14)}
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>Next: High-ROI Topics</h3>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
              Foundation complete and gaps identified. Phase 3 targets your missing skills directly for the {company} interview.
            </p>
            <button
              onClick={() => onNavigate("plan")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: C.purple, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Continue to High-ROI Topics {Ico.arrowRight(12)}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: FOUNDATION TOPICS ── */}
      {activeTab === "topics" && (
        <div className="sp-fade-up">
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
            All foundation topics completed with high mastery. These form the base for advanced interview preparation.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {foundationTopics.map((topic, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{topic.title}</h4>
                  <Badge label="Mastered" color={C.greenLight} bg={C.greenBg} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  {Ico.clock(11)}
                  <span style={{ fontSize: 11, color: C.textDim }}>{topic.time} study time</span>
                </div>
                <ProgressBar pct={topic.mastery} color={C.greenLight} height={5} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>{topic.mastery}% mastery</span>
                  <button
                    onClick={() => onNavigate("topic", { topicTitle: topic.title })}
                    style={{ fontSize: 11, fontWeight: 700, color: C.purpleLight, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    Review {Ico.arrowRight(10)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: GAP ANALYSIS ── */}
      {activeTab === "gaps" && (
        <div className="sp-fade-up">
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
            Based on your resume, course content, and the {company} {role} JD, these gaps need immediate attention in Phase 3.
          </p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 14, marginBottom: 24 }}>
            {gaps.map((gap, i) => (
              <div
                key={i}
                style={{
                  background: C.card,
                  border: `1px solid ${gap.severity === "high" ? "rgba(220,38,38,0.25)" : "rgba(245,158,11,0.25)"}`,
                  borderLeft: `4px solid ${gap.severity === "high" ? C.red : C.amber}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{gap.skill}</h4>
                      <Badge
                        label={gap.severity === "high" ? "High Priority" : "Medium Priority"}
                        color={gap.severity === "high" ? C.red : C.amber}
                        bg={gap.severity === "high" ? "rgba(220,38,38,0.1)" : C.amberBg}
                      />
                      {gap.inCourse && <Badge label="In Course" color={C.purpleLight} bg={C.purpleDim} />}
                    </div>
                    <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{gap.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {Ico.lightbulb(14)}
              <span style={{ fontSize: 11, fontWeight: 700, color: C.purpleLight, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Strategy</span>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.7 }}>
              Phase 3 (High-ROI Topics) will focus exclusively on these gaps. Each gap will be addressed with targeted study, practice problems, and interview-style Q&A to bring you to interview-ready proficiency.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: FOUNDATION QUIZ ── */}
      {activeTab === "quiz" && (
        <div className="sp-fade-up">
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 26px", textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>Foundation Mastery Quiz</h3>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 auto 20px", maxWidth: 480, lineHeight: 1.6 }}>
              Test your understanding of all foundation topics — Arrays, Linked Lists, Trees, Graphs, Sorting, and Hash Tables.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 22 }}>
              <Badge label="5 Questions" color={C.purpleLight} bg={C.purpleDim} />
              <Badge label="~10 min" color={C.textMuted} bg={C.surface} />
              <Badge label="Mixed Difficulty" color={C.amber} bg={C.amberBg} />
            </div>
            <button
              onClick={() => onNavigate("quiz", { quizTopic: "Foundation Mastery", quizQuestions: foundationQuizQuestions })}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 32px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {Ico.play(14)} Start Foundation Quiz
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { topic: "Arrays & Strings", avgScore: 95 },
              { topic: "Linked Lists", avgScore: 90 },
              { topic: "Trees & Graphs", avgScore: 88 },
              { topic: "Stacks & Queues", avgScore: 92 },
              { topic: "Hash Tables", avgScore: 96 },
              { topic: "Sorting & Searching", avgScore: 94 },
            ].map((item, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <h5 style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>{item.topic}</h5>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>1 question</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.greenLight }}>{item.avgScore}%</span>
                </div>
                <ProgressBar pct={item.avgScore} color={C.greenLight} height={3} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 1 — PREP PLAN (TARGET READINESS)
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen1PrepPlan({
  dynamicPlan,
  company,
  role,
  daysLeft,
  readinessPct,
  onNavigate,
  onRegenerate,
  onReset,
  generating,
}: {
  dynamicPlan: PlanDetailResponse | null;
  company: string;
  role: string;
  daysLeft: number;
  readinessPct: number;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  onRegenerate: () => void;
  onReset: () => void;
  generating: boolean;
}) {
  const dailyPlan: DailyPlanItem[] = dynamicPlan?.plan_json?.daily_plan ?? [];

  // Map daily plan items to High-ROI topic cards
  const topicCards = dailyPlan.slice(0, 4).map((day, i) => ({
    title: day.focus,
    status: i === 0 ? "in-progress" : "queued",
    progress: i === 0 ? 45 : 0,
    day: day.day,
    tasks: day.tasks,
    // Collect all quiz questions from this day's tasks for the quiz screen
    allQuizQuestions: day.tasks.flatMap(t => t.quiz ?? []),
  }));

  return (
    <div className="sp-fade-up" style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight }}>{company || "Google"}</span>
            <span style={{ color: C.textDim }}>•</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>{role || "Senior L5 Backend"}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.5px" }}>
            Target Readiness
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Readiness score */}
          <div style={{ textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 18px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.purpleLight, lineHeight: 1 }}>{readinessPct}%</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Readiness</div>
          </div>
          {/* Days left */}
          <div style={{ textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 18px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.amber, lineHeight: 1 }}>{daysLeft}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Days Left</div>
          </div>
          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            <button
              onClick={onRegenerate}
              disabled={generating}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {Ico.refresh(12)} Regenerate
            </button>
            <button
              onClick={onReset}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {Ico.x(12)} Reset Plan
            </button>
          </div>
        </div>
      </div>

      {/* ── Generating state ── */}
      {generating && (
        <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 18, height: 18, border: `2px solid ${C.purpleLight}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 13, color: C.purpleLight, fontWeight: 600 }}>Generating your personalized prep plan with AI…</span>
        </div>
      )}

      {/* ── Timeline ── */}
      <div style={{ position: "relative" as const }}>
        {/* Vertical line */}
        <div style={{ position: "absolute" as const, left: 19, top: 24, bottom: 24, width: 2, background: `linear-gradient(to bottom, ${C.green}, ${C.purple}, ${C.border})`, borderRadius: 2 }} />

        {/* Phase 1 — Foundation */}
        <PhaseRow
          index={1}
          title="Foundation"
          status="completed"
          description="Completed core algorithms and data structure basics."
          onClick={() => onNavigate("foundation")}
        />

        {/* Phase 2 — Gaps Identification */}
        <PhaseRow
          index={2}
          title="Gaps Identification"
          status="completed"
          description="Initial assessment complete. Identified concurrency and LLD as primary focus areas."
          onClick={() => onNavigate("foundation", { foundationTab: "gaps" })}
        />

        {/* Phase 3 — High-ROI Topics (active) */}
        <PhaseRow
          index={3}
          title="High-ROI Topics"
          status="active"
          description=""
          extra={
            <div style={{ marginTop: 14 }}>
              {topicCards.length === 0 ? (
                <div style={{ color: C.textDim, fontSize: 13 }}>
                  {generating ? "Generating topics…" : "No topics yet. Generate a plan to get started."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {topicCards.map((tc, i) => (
                    <TopicCard
                      key={i}
                      title={tc.title}
                      status={tc.status as "in-progress" | "queued"}
                      progress={tc.progress}
                      onClick={() => onNavigate("topic", { topicTitle: tc.title, topicDay: tc.day, topicTasks: tc.tasks, quizQuestions: tc.allQuizQuestions })}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => onNavigate("curriculum")}
                style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Explore More {Ico.arrowRight(12)}
              </button>
            </div>
          }
        />

        {/* Phase 4 — System Design (locked) */}
        <PhaseRow
          index={4}
          title="System Design Phase"
          status="locked"
          description="Unlock after completing High-ROI Topics."
        />

        {/* Phase 5 — Behavioral (locked) */}
        <PhaseRow
          index={5}
          title="Behavioral / Leadership"
          status="locked"
          description="Final phase — communication, leadership, and culture fit."
        />
      </div>

      {/* ── Overview card ── */}
      {dynamicPlan?.plan_json?.overview && (
        <div style={{ marginTop: 28, background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {Ico.lightbulb(14)}
            <span style={{ fontSize: 11, fontWeight: 700, color: C.purpleLight, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>AI Overview</span>
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>{dynamicPlan.plan_json.overview}</p>
        </div>
      )}
    </div>
  );
}

function PhaseRow({
  index,
  title,
  status,
  description,
  extra,
  onClick,
}: {
  index: number;
  title: string;
  status: "completed" | "active" | "locked";
  description: string;
  extra?: React.ReactNode;
  onClick?: () => void;
}) {
  const dotColor = status === "completed" ? C.green : status === "active" ? C.purple : C.border;
  const dotBg = status === "completed" ? C.greenBg : status === "active" ? C.purpleDim : C.surface;
  const isClickable = !!onClick && status !== "locked";

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        display: "flex", gap: 20, marginBottom: 28, position: "relative" as const,
        cursor: isClickable ? "pointer" : "default",
        borderRadius: 12,
        padding: isClickable ? "6px 8px 6px 0" : "0",
        margin: isClickable ? "0 -8px 28px" : "0 0 28px",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = "#f7ffe0"; }}
      onMouseLeave={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {/* Dot */}
      <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "center", paddingLeft: isClickable ? 8 : 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", background: dotBg,
          border: `2px solid ${dotColor}`, display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1, position: "relative" as const,
        }}>
          {status === "completed"
            ? Ico.check(16, C.greenLight)
            : status === "locked"
            ? Ico.lock(14)
            : <span style={{ fontSize: 13, fontWeight: 800, color: C.purpleLight }}>{index}</span>}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: status === "locked" ? C.textDim : C.text }}>{title}</span>
          {status === "completed" && <Badge label="Completed" color={C.greenLight} bg={C.greenBg} />}
          {status === "active" && <Badge label="Currently Active" color={C.purpleLight} bg={C.purpleDim} />}
          {status === "locked" && <Badge label="Locked" color={C.textDim} bg={C.surface} />}
          {isClickable && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.purpleLight }}>
              View {Ico.arrowRight(10)}
            </span>
          )}
        </div>
        {description && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{description}</p>
        )}
        {extra}
      </div>
    </div>
  );
}

function TopicCard({
  title,
  status,
  progress,
  onClick,
}: {
  title: string;
  status: "in-progress" | "queued";
  progress: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.cardHover : C.card,
        border: `1px solid ${hovered ? C.purple : C.border}`,
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{title}</span>
        {status === "in-progress"
          ? <Badge label="In Progress" color={C.purpleLight} bg={C.purpleDim} />
          : <Badge label="Queued" color={C.textDim} bg={C.surface} />}
      </div>
      {status === "in-progress" ? (
        <>
          <ProgressBar pct={progress} />
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{progress}% complete</div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.purpleLight, marginTop: 4 }}>
          START TOPIC {Ico.arrowRight(10)}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 2 — CURRICULUM LIBRARY
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen2Curriculum({ onNavigate }: { onNavigate: (s: string, extra?: Record<string, unknown>) => void }) {
  const [filter, setFilter] = useState<"all" | "not-started" | "in-progress" | "mastered">("all");

  const filterTabs = [
    { key: "all", label: "All Topics" },
    { key: "not-started", label: "Not Started" },
    { key: "in-progress", label: "In Progress" },
    { key: "mastered", label: "Mastered" },
  ] as const;

  const sysDesignTopics = [
    { title: "High Scalability", time: "90min", mastery: 65, status: "in-progress" },
    { title: "CAP Theorem", time: "45min", mastery: 0, status: "not-started" },
    { title: "Sharding Strategies", time: "60min", mastery: 100, status: "mastered" },
  ];

  const behavioralTopics = [
    { title: "Conflict Resolution", time: "30min", roi: "High ROI" },
    { title: "Systemic Impact", time: "45min", roi: "Med ROI" },
    { title: "Decision Making", time: "25min", roi: "High ROI" },
    { title: "Mentorship", time: "20min", roi: "Med ROI" },
  ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Breadcrumb
        items={[{ label: "Prep Plan", screen: "plan" }, { label: "Curriculum Library" }]}
        onNavigate={onNavigate}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>Curriculum Library</h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, background: C.surface, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: filter === t.key ? C.purple : "none",
              color: filter === t.key ? C.white : C.textMuted,
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section: System Design */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>System Design & Architecture</h2>
          <Badge label="HIGH ROI" color={C.purpleLight} bg={C.purpleDim} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {sysDesignTopics.map((t, i) => (
            <CurriculumTopicCard
              key={i}
              title={t.title}
              time={t.time}
              mastery={t.mastery}
              status={t.status as "in-progress" | "not-started" | "mastered"}
              onClick={() => onNavigate("topic", { topicTitle: t.title })}
            />
          ))}
        </div>
      </div>

      {/* Section: Advanced DSA */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>Advanced Data Structures & Algorithms</h2>
          <Badge label="MEDIUM ROI" color={C.amber} bg={C.amberBg} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Featured card */}
          <div
            onClick={() => onNavigate("topic", { topicTitle: "Graph Theory Mastery" })}
            style={{
              background: `linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)`,
              border: `1px solid #d9f36e`, borderRadius: 14, padding: "22px 20px",
              cursor: "pointer", position: "relative" as const, overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute" as const, top: 0, right: 0, width: 120, height: 120, background: "radial-gradient(circle, rgba(217,243,110,0.4) 0%, transparent 70%)", borderRadius: "50%" }} />
            <Badge label="NEW TRACK • 12 Topics" color="#222222" bg="rgba(217,243,110,0.4)" />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "12px 0 16px" }}>Graph Theory Mastery</h3>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: C.purple, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Enroll in Track {Ico.arrowRight(12)}
            </button>
          </div>
          {/* DP card */}
          <div
            onClick={() => onNavigate("topic", { topicTitle: "Dynamic Programming" })}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px 20px", cursor: "pointer" }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>Dynamic Programming</h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 16 }}>
              {[["25 Patterns", C.purpleLight], ["15h Content", C.textMuted], ["High Difficulty", C.red]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
                </div>
              ))}
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Start Track {Ico.arrowRight(12)}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Behavioral */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>Behavioral & Leadership</h2>
          <button style={{ fontSize: 12, color: C.purpleLight, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            View all 18 topics
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {behavioralTopics.map((t, i) => (
            <div
              key={i}
              onClick={() => onNavigate("topic", { topicTitle: t.title })}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>{t.title}</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                {Ico.clock(11)}
                <span style={{ fontSize: 11, color: C.textDim }}>{t.time}</span>
              </div>
              <Badge
                label={t.roi}
                color={t.roi.startsWith("High") ? C.purpleLight : C.amber}
                bg={t.roi.startsWith("High") ? C.purpleDim : C.amberBg}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurriculumTopicCard({
  title,
  time,
  mastery,
  status,
  onClick,
}: {
  title: string;
  time: string;
  mastery: number;
  status: "in-progress" | "not-started" | "mastered";
  onClick: () => void;
}) {
  const ctaLabel = status === "in-progress" ? "Continue Prep" : status === "mastered" ? "Review Again" : "Start Learning";
  const ctaColor = status === "mastered" ? C.green : C.purple;

  return (
    <div
      onClick={onClick}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {Ico.clock(11)}
        <span style={{ fontSize: 11, color: C.textDim }}>{time}</span>
        {status === "mastered" && <Badge label="Mastered" color={C.greenLight} bg={C.greenBg} />}
      </div>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 10px" }}>{title}</h4>
      <ProgressBar pct={mastery} color={status === "mastered" ? C.green : C.purple} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 11, color: C.textDim }}>{mastery}% mastery</span>
        <button
          style={{ fontSize: 11, fontWeight: 700, color: ctaColor, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          {ctaLabel} {Ico.arrowRight(10)}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 3 — TOPIC DETAIL
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen3TopicDetail({
  topicTitle,
  topicTasks,
  quizQuestions,
  onNavigate,
}: {
  topicTitle: string;
  topicTasks: LearningTask[];
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  // Build core concepts from AI tasks (qa_pairs) or fallback to static
  const aiCoreConcepts = topicTasks
    .filter(t => t.task_type === "qa" && t.qa_pairs && t.qa_pairs.length > 0)
    .slice(0, 3)
    .map(t => ({
      title: t.title,
      desc: t.qa_pairs![0]?.question ?? t.description,
      task: t,
    }));

  const coreConcepts = aiCoreConcepts.length > 0 ? aiCoreConcepts : [
    { title: "Java Memory Model", desc: "Visibility, happens-before, volatile semantics", task: null },
    { title: "Reentrant Locks", desc: "Lock fairness, tryLock, condition variables", task: null },
    { title: "ThreadPool Tuning", desc: "Core/max pool size, queue strategies, rejection policies", task: null },
  ];

  // Build interview traps from AI qa_pairs or fallback
  const aiTraps = topicTasks
    .flatMap(t => t.qa_pairs ?? [])
    .filter(qp => qp.explanation && qp.explanation.toLowerCase().includes("trap"))
    .slice(0, 3)
    .map(qp => qp.question);

  const traps = aiTraps.length > 0 ? aiTraps : [
    "Assuming volatile guarantees atomicity for compound operations",
    "Ignoring thread interruption in blocking calls",
    "Using synchronized on non-final fields causing lock escape",
  ];

  const practiceItems = topicTasks.length > 0
    ? topicTasks.slice(0, 3).map((t) => ({ title: t.title, duration: t.duration_minutes, task: t }))
    : [
        { title: "Implement a thread-safe LRU Cache", duration: 30, task: null },
        { title: "Diagnose a deadlock scenario", duration: 20, task: null },
        { title: "Design a producer-consumer pipeline", duration: 25, task: null },
      ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Breadcrumb
        items={[
          { label: "Prep Plan", screen: "plan" },
          { label: "High-ROI Topics", screen: "plan" },
          { label: topicTitle },
        ]}
        onNavigate={onNavigate}
      />

      {/* Tags + Title */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Badge label="Hard" color={C.red} bg="rgba(220,38,38,0.15)" />
        <Badge label="High Frequency" color={C.amber} bg={C.amberBg} />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{topicTitle}</h1>

      {/* Mastery bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Mastery Level</span>
          <span style={{ fontSize: 12, color: C.purpleLight, fontWeight: 700 }}>45%</span>
        </div>
        <ProgressBar pct={45} height={6} />
      </div>

      {/* Strategic Insights */}
      <div style={{
        background: `linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)`,
        border: `1px solid #d9f36e`, borderRadius: 14, padding: "20px 22px", marginBottom: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {Ico.star(14)}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#555555", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Strategic Insights</span>
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>
          Top-tier companies like Google, Meta, and Amazon heavily test concurrency because it reveals how engineers think about correctness under parallelism. Candidates who can reason about memory visibility, lock granularity, and thread-safety trade-offs stand out significantly in senior-level interviews. Mastering this topic directly impacts your system design credibility.
        </p>
      </div>

      {/* Core Concepts */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Core Concepts</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {coreConcepts.map((c, i) => (
            <div
              key={i}
              onClick={() => onNavigate("concept", {
                conceptTitle: c.title,
                parentTopic: topicTitle,
                conceptTask: c.task,
                quizQuestions: c.task?.quiz ?? quizQuestions ?? [],
              })}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px", cursor: "pointer" }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>{c.title}</h4>
              <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 12px", lineHeight: 1.5 }}>{c.desc}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.purpleLight }}>
                Learn More {Ico.arrowRight(10)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: Traps + Practice */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Interview Traps */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
            {Ico.zap(14)} Interview Traps
          </h3>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {traps.map((trap, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.red, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{trap}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Practice */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
            {Ico.play(14)} Active Practice
          </h3>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 14 }}>
            {practiceItems.map((p, i) => (
              <div
                key={i}
                onClick={() => onNavigate("coding")}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface, borderRadius: 8, cursor: "pointer" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {Ico.play(10)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>{p.duration} min</div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("coding")}
            style={{ width: "100%", padding: "8px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            View All Tasks
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 4 — TOPIC DEEP CONTENT (Concept Detail)
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen4ConceptDetail({
  conceptTitle,
  parentTopic,
  conceptTask,
  quizQuestions,
  onNavigate,
}: {
  conceptTitle: string;
  parentTopic: string;
  conceptTask?: LearningTask | null;
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  // Build Core Mechanics from AI qa_pairs if available
  const aiMechanics = (conceptTask?.qa_pairs ?? [])
    .filter(qp => qp.question && qp.explanation)
    .map(qp => ({
      title: qp.question,
      detail: qp.explanation.replace(/\n\n/g, " ").replace(/\n/g, " "),
    }));

  const mechanics = aiMechanics.length > 0 ? aiMechanics : [
    {
      title: "Heap vs Stack Memory",
      detail: "In the Java Virtual Machine, memory is divided into two primary regions: the heap and the stack. The heap is a shared memory area where all objects and class instances are allocated — every thread in the JVM can read and write to the same heap objects. The stack, by contrast, is thread-private: each thread has its own stack containing local variables, method call frames, and references to heap objects. This separation means that while local primitive variables are inherently thread-safe (they live on the stack), any object stored on the heap is potentially accessible by multiple threads simultaneously, making synchronization critical for correctness."
    },
    {
      title: "Visibility Guarantees",
      detail: "Without explicit synchronization, the Java Memory Model does NOT guarantee that a write performed by one thread will ever be visible to another thread. This is because modern CPUs use multi-level caches (L1, L2, L3) and each thread may be working with a locally cached copy of a variable. A thread can read a stale value indefinitely unless a happens-before relationship is established. The JMM defines visibility through synchronization actions: entering/exiting a synchronized block, reading/writing a volatile variable, starting a thread, or joining a thread all create visibility guarantees between threads."
    },
    {
      title: "Happens-Before Relation",
      detail: "The happens-before relationship is the formal mechanism the JMM uses to define ordering guarantees between memory operations across threads. If action A happens-before action B, then all memory writes visible to A are guaranteed to be visible to B. Key happens-before rules include: (1) Program order — each action in a thread happens-before every subsequent action in that same thread. (2) Monitor lock — an unlock on a monitor happens-before every subsequent lock on that same monitor. (3) Volatile write — a write to a volatile field happens-before every subsequent read of that field. (4) Thread start — a call to Thread.start() happens-before any action in the started thread."
    },
    {
      title: "Volatile Keyword",
      detail: "Declaring a field as volatile provides two guarantees: visibility and ordering, but NOT atomicity. Visibility means that every write to a volatile variable is immediately flushed to main memory, and every read of a volatile variable reads directly from main memory — bypassing CPU caches. Ordering means that volatile reads and writes cannot be reordered with other memory operations (they act as memory barriers). However, volatile does NOT make compound operations atomic: the expression i++ on a volatile int is still a read-modify-write sequence that can be interrupted by another thread. Use volatile for simple flags and state indicators; use AtomicInteger or synchronized blocks for compound operations."
    },
  ];

  const pitfalls = [
    { title: "Stale Reads", desc: "Thread caches a variable locally; misses updates from other threads." },
    { title: "Instruction Reordering", desc: "JIT compiler and CPU may reorder instructions for performance." },
    { title: "Lost Updates", desc: "Two threads read-modify-write the same variable without synchronization." },
  ];

  const advanced = [
    { title: "CAS Compare-And-Swap", desc: "Atomic hardware instruction enabling lock-free algorithms." },
    { title: "The Unsafe Class", desc: "Low-level JVM operations — used by java.util.concurrent internals." },
  ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Top row: breadcrumb left, buttons right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <Breadcrumb
          items={[
            { label: "Prep Plan", screen: "plan" },
            { label: parentTopic, screen: "topic" },
            { label: conceptTitle },
          ]}
          onNavigate={onNavigate}
        />
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onNavigate("plan")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {Ico.arrowLeft(12)} Back to Plan
          </button>
          <button
            onClick={() => onNavigate("simulation")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: C.purple, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {Ico.play(12)} New Session
          </button>
        </div>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>{conceptTitle}</h1>
      <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, marginBottom: 28, maxWidth: 700 }}>
        The Java Memory Model (JMM) defines how threads interact through memory. It specifies when writes by one thread become visible to reads by another, providing the foundation for writing correct concurrent programs in Java.
      </p>

      {/* Core Mechanics */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Core Mechanics</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mechanics.map((m, i) => (
            <div key={i} style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderLeft: `4px solid #d9f36e`,
              borderRadius: 12,
              padding: "18px 20px"
            }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 10px" }}>{m.title}</h4>
              <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.75 }}>{m.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* JVM Diagram */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>Visualizing the JVM</h2>
        <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
          {/* Thread stacks */}
          <div style={{ flex: 1, background: "#f7ffe0", border: `1px solid #d9f36e`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555555", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Thread Stacks</div>
            {["Thread 1 Stack", "Thread 2 Stack"].map((t, i) => (
              <div key={i} style={{ background: "#edffd6", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12, color: "#444444" }}>
                {t}
                <div style={{ fontSize: 11, color: "#888888", marginTop: 2 }}>Local variables, references</div>
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div style={{ display: "flex", alignItems: "center", color: C.textDim, fontSize: 20 }}>⇄</div>
          {/* Main memory */}
          <div style={{ flex: 1, background: "#f7ffe0", border: `1px solid #d9f36e`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555555", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Main Memory (Heap)</div>
            {["Shared Objects", "Static Fields", "Class Definitions"].map((item, i) => (
              <div key={i} style={{ background: "#edffd6", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12, color: "#444444" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Common Pitfalls */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Common Pitfalls</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {pitfalls.map((p, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />
                <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{p.title}</h4>
              </div>
              <p style={{ fontSize: 12, color: C.textDim, margin: 0, lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Concepts */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Advanced Concepts</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {advanced.map((a, i) => (
            <div key={i} style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 12, padding: "16px 18px" }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.purpleLight, margin: "0 0 6px" }}>{a.title}</h4>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>Calculate Your Readiness</h3>
        <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 16px" }}>Test your understanding with a hands-on coding task or a technical Q&A quiz.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => onNavigate("coding")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {Ico.code(14)} Start Coding Task
          </button>
          <button
            onClick={() => onNavigate("quiz", { quizTopic: conceptTitle, quizQuestions: quizQuestions ?? [] })}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {Ico.book(14)} Technical QA Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 5 — LIVE SIMULATION
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen5Simulation({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [seconds, setSeconds] = useState(24 * 60 + 12);
  const [transcript, setTranscript] = useState([
    "AI: Let's start with the high-level architecture. How would you handle 10M daily active users?",
    "You: I'd begin with a horizontally scalable API layer behind a load balancer...",
    "AI: Good. What consistency model would you choose for the message store?",
  ]);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const nodes = [
    { id: "lb", label: "Load Balancer", x: 80, y: 120, color: C.purple },
    { id: "us", label: "User Service", x: 280, y: 80, color: C.blue },
    { id: "ms", label: "Msg Service", x: 280, y: 160, color: C.blue },
    { id: "db", label: "Database", x: 480, y: 120, color: C.green },
  ];

  const edges = [
    { from: { x: 80, y: 120 }, to: { x: 280, y: 80 } },
    { from: { x: 80, y: 120 }, to: { x: 280, y: 160 } },
    { from: { x: 280, y: 80 }, to: { x: 480, y: 120 } },
    { from: { x: 280, y: 160 }, to: { x: 480, y: 120 } },
  ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Badge label="LIVE SIMULATION" color={C.red} bg="rgba(220,38,38,0.15)" />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>System Design: Messenger App</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 16px", fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: C.purpleLight, letterSpacing: "0.1em" }}>
            {fmt(seconds)}
          </div>
          <button
            onClick={() => onNavigate("plan")}
            style={{ padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Exit Session
          </button>
        </div>
      </div>

      {/* AI Hero Card */}
      <div style={{
        background: `linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)`,
        border: `1px solid #d9f36e`, borderRadius: 16, padding: "20px 24px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 20,
      }}>
        {/* AI Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
          background: `#d9f36e`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, border: `2px solid #222222`,
        }}>
          🤖
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>SYSTEM ARCH AI</div>
          <p style={{ fontSize: 14, color: C.text, margin: "0 0 12px", lineHeight: 1.6 }}>
            Design a scalable real-time messaging system that supports 10M daily active users, message persistence, and delivery guarantees. Walk me through your architecture decisions.
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.greenLight }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>CLARITY <strong style={{ color: C.greenLight }}>92%</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>PACING <strong style={{ color: C.amber }}>Optimal</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 20, position: "relative" as const, height: 220 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>Architecture Canvas</div>
        <svg width="100%" height="160" style={{ position: "absolute" as const, top: 40, left: 0 }}>
          {edges.map((e, i) => (
            <line key={i} x1={e.from.x + 50} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke={C.border} strokeWidth="1.5" strokeDasharray="4 3" />
          ))}
          {nodes.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y - 18} width={90} height={36} rx={8} fill={C.surface} stroke={n.color} strokeWidth="1.5" />
              <text x={n.x + 45} y={n.y + 5} textAnchor="middle" fill={C.text} fontSize="11" fontWeight="600">{n.label}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Transcript */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>Live Transcript</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, maxHeight: 120, overflowY: "auto" as const }} className="sp-scroll">
          {transcript.map((line, i) => (
            <p key={i} style={{ fontSize: 12, color: line.startsWith("AI:") ? C.purpleLight : C.textMuted, margin: 0, lineHeight: 1.6 }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          style={{ padding: "10px 20px", borderRadius: 10, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Save Draft
        </button>
        <button
          onClick={() => onNavigate("plan")}
          style={{ padding: "10px 24px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Submit Session
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 6 — CODING SANDBOX
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen6Coding({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [code, setCode] = useState(`class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}
        self.order = []

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.order.remove(key)
        self.order.append(key)
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.order.remove(key)
        elif len(self.cache) >= self.capacity:
            lru = self.order.pop(0)
            del self.cache[lru]
        self.cache[key] = value
        self.order.append(key)`);

  const [activeTab, setActiveTab] = useState<"console" | "output" | "tests">("tests");
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ label: string; passed: boolean; input: string; expected: string; got: string }[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(42 * 60 + 15);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleRunTests = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setActiveTab("tests");
      setTestResults([
        { label: "Test 1", passed: true, input: 'LRUCache(2); put(1,1); put(2,2); get(1)', expected: "1", got: "1" },
        { label: "Test 2", passed: true, input: 'put(3,3); get(2)', expected: "-1", got: "-1" },
        { label: "Test 3", passed: false, input: 'put(4,4); get(1)', expected: "-1", got: "1" },
      ]);
    }, 1800);
  };

  const constraints = [
    "1 ≤ capacity ≤ 3000",
    "0 ≤ key ≤ 10⁴",
    "0 ≤ value ≤ 10⁵",
    "At most 2 × 10⁵ calls to get and put",
  ];

  return (
    <div className="sp-fade-up" style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" as const }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => onNavigate("topic")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {Ico.arrowLeft(12)} Prep Plan
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: C.amber }}>
              {fmt(secondsLeft)} REMAINING
            </div>
            <Badge label="Step 2 of 5" color={C.textMuted} bg={C.surface} />
          </div>
        </div>
        <button
          onClick={handleRunTests}
          disabled={running}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 10, background: C.green, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: running ? 0.7 : 1 }}
        >
          {running ? (
            <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: C.white, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Running…</>
          ) : (
            <>{Ico.play(14)} Run Tests</>
          )}
        </button>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, minHeight: 0 }}>
        {/* Left: Problem */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" as const }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Badge label="Medium" color={C.amber} bg={C.amberBg} />
              <span style={{ fontSize: 11, color: C.textDim }}>Problem 146</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>Optimize LRU Cache</h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto" as const, padding: "16px 20px" }} className="sp-scroll">
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
              Design a data structure that follows the constraints of a <strong style={{ color: C.text }}>Least Recently Used (LRU) cache</strong>.
            </p>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
              Implement the <code style={{ background: C.surface, padding: "1px 6px", borderRadius: 4, color: C.purpleLight }}>LRUCache</code> class with <code style={{ background: C.surface, padding: "1px 6px", borderRadius: 4, color: C.purpleLight }}>get(key)</code> and <code style={{ background: C.surface, padding: "1px 6px", borderRadius: 4, color: C.purpleLight }}>put(key, value)</code> operations, both running in <strong style={{ color: C.text }}>O(1) average time complexity</strong>.
            </p>
            <div style={{ background: C.surface, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>Constraints</div>
              {constraints.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.purple, flexShrink: 0 }} />
                  <code style={{ fontSize: 12, color: C.textMuted }}>{c}</code>
                </div>
              ))}
            </div>
            <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.purpleLight, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>Hint</div>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
                Consider using a combination of a HashMap and a doubly-linked list to achieve O(1) for both operations.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Editor + Console */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0, background: "#f8f8f8", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}` }}>
          {/* Editor header */}
          <div style={{ padding: "10px 16px", background: "#f0f0f0", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.greenLight }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Python 3</span>
            </div>
          </div>

          {/* Monaco */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor
              height="100%"
              language="python"
              theme="light"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineNumbersMinChars: 3,
              }}
            />
          </div>

          {/* Console / Output / Tests */}
          <div style={{ height: 180, background: "#f3f3f3", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column" as const, flexShrink: 0 }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              {(["console", "output", "tests"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 16px", background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, textTransform: "capitalize" as const,
                    color: activeTab === tab ? C.purple : C.textDim,
                    borderBottom: activeTab === tab ? `2px solid ${C.purple}` : "2px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto" as const, padding: "10px 16px" }} className="sp-scroll">
              {activeTab === "console" && (
                <p style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", margin: 0 }}>Console output will appear here…</p>
              )}
              {activeTab === "output" && (
                <p style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", margin: 0 }}>Run tests to see output…</p>
              )}
              {activeTab === "tests" && testResults.length === 0 && (
                <p style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", margin: 0 }}>Click "Run Tests" to execute test cases…</p>
              )}
              {activeTab === "tests" && testResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                  {testResults.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: r.passed ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)", borderRadius: 6, border: `1px solid ${r.passed ? "rgba(5,150,105,0.2)" : "rgba(220,38,38,0.2)"}` }}>
                      <span style={{ fontSize: 12, color: r.passed ? C.greenLight : C.red }}>{r.passed ? "✓" : "✗"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: r.passed ? C.greenLight : C.red }}>{r.label}</span>
                      <span style={{ fontSize: 11, color: C.textDim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.input}</span>
                      {!r.passed && <span style={{ fontSize: 11, color: C.red }}>Expected {r.expected}, got {r.got}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SCREEN 7 — TECHNICAL QA QUIZ
 * ───────────────────────────────────────────────────────────────────────────── */
function Screen7Quiz({
  quizTopic,
  quizQuestions,
  onNavigate,
}: {
  quizTopic: string;
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  // Use AI-generated questions if available, otherwise fall back to hardcoded JMM questions
  const fallbackQuestions = [
    {
      question: "What does the volatile keyword guarantee in Java?",
      options: [
        "Atomicity and visibility",
        "Visibility and ordering, but NOT atomicity",
        "Only atomicity for primitive types",
        "Thread-safe compound operations like i++",
      ],
      correct_index: 1,
      explanation: "volatile guarantees visibility (writes flush to main memory immediately) and ordering (acts as a memory barrier), but does NOT make compound operations like i++ atomic. For atomic compound operations, use AtomicInteger or synchronized.",
    },
    {
      question: "Which happens-before rule applies when Thread A calls thread.start()?",
      options: [
        "All actions in Thread A happen-before Thread B's actions",
        "Only the start() call happens-before Thread B",
        "Thread B's actions happen-before Thread A's subsequent actions",
        "No happens-before relationship is established",
      ],
      correct_index: 0,
      explanation: "Thread start rule: all actions in Thread A that happen before Thread A calls thread.start() are guaranteed to be visible to Thread B when it begins executing. This is one of the core happens-before rules in the JMM.",
    },
    {
      question: "Why can a thread read a stale value even after another thread writes to a shared variable?",
      options: [
        "Java has a bug in its memory management",
        "The JVM always caches variables in registers",
        "Modern CPUs use multi-level caches; threads may work with locally cached copies",
        "The garbage collector clears shared memory periodically",
      ],
      correct_index: 2,
      explanation: "Modern CPUs have L1/L2/L3 caches. Each thread may be working with a locally cached copy of a variable. Without synchronization (volatile, synchronized, or other happens-before actions), the JMM does not guarantee that writes by one thread are ever flushed to main memory and visible to other threads.",
    },
    {
      question: "What is the difference between the heap and the stack in the JVM?",
      options: [
        "Heap is for primitives; stack is for objects",
        "Heap is thread-private; stack is shared across threads",
        "Heap is shared across all threads; stack is thread-private",
        "Both heap and stack are shared across all threads",
      ],
      correct_index: 2,
      explanation: "The heap is a shared memory area where all objects are allocated — every thread can access the same heap objects. The stack is thread-private: each thread has its own stack containing local variables and method call frames. This is why heap objects need synchronization but local variables don't.",
    },
    {
      question: "Which of the following is a valid use case for the volatile keyword?",
      options: [
        "Implementing a thread-safe counter with increment operations",
        "A boolean flag that one thread writes and others read",
        "Protecting a block of code that reads and writes multiple variables",
        "Replacing synchronized for all thread-safety needs",
      ],
      correct_index: 1,
      explanation: "volatile is ideal for simple flags where one thread writes a single value and other threads only read it. Since there's no compound operation (just a single read or write), atomicity is not needed — only visibility. For counters or multi-variable operations, use synchronized or AtomicInteger.",
    },
  ];

  // Normalize AI questions to use correct_index (they may come as correct_index from API)
  const activeQuestions = (quizQuestions && quizQuestions.length > 0)
    ? quizQuestions.map(q => ({
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      }))
    : fallbackQuestions;

  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(activeQuestions.length).fill(null));

  const q = activeQuestions[currentQ];

  const handleSelect = (idx: number) => {
    if (submitted) return;
    setSelected(idx);
    const updated = [...answers];
    updated[currentQ] = idx;
    setAnswers(updated);
  };

  const handleSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
    if (selected === q.correct_index) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (currentQ < activeQuestions.length - 1) {
      setCurrentQ((q) => q + 1);
      setSelected(answers[currentQ + 1]);
      setSubmitted(answers[currentQ + 1] !== null);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentQ(0);
    setSelected(null);
    setSubmitted(false);
    setScore(0);
    setFinished(false);
    setAnswers(new Array(activeQuestions.length).fill(null));
  };

  const pct = Math.round((score / activeQuestions.length) * 100);

  return (
    <div className="sp-fade-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <button
              onClick={() => onNavigate("concept")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {Ico.arrowLeft(12)} Back
            </button>
            <span style={{ fontSize: 12, color: C.textDim }}>Technical QA Quiz</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>{quizTopic}</h1>
        </div>
        {!finished && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{currentQ + 1} / {activeQuestions.length}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Score: {score}</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!finished && (
        <div style={{ marginBottom: 28 }}>
          <ProgressBar pct={((currentQ) / activeQuestions.length) * 100} color="#d9f36e" height={6} />
        </div>
      )}

      {finished ? (
        /* ── Results screen ── */
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "36px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>
            {pct >= 80 ? "🎉" : pct >= 60 ? "👍" : "📚"}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>
            {pct >= 80 ? "Excellent!" : pct >= 60 ? "Good Progress!" : "Keep Studying!"}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 24px" }}>
            You scored <strong style={{ color: C.text }}>{score} out of {activeQuestions.length}</strong> ({pct}%)
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 28, background: C.surface, borderRadius: 10, padding: 4, width: "fit-content", margin: "0 auto 28px" }}>
            <div style={{ padding: "8px 20px", borderRadius: 8, background: "#d9f36e", fontSize: 13, fontWeight: 700, color: "#222222" }}>
              {score} Correct
            </div>
            <div style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: C.textMuted }}>
              {activeQuestions.length - score} Incorrect
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={handleRestart}
              style={{ padding: "10px 24px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Retry Quiz
            </button>
            <button
              onClick={() => onNavigate("concept")}
              style={{ padding: "10px 24px", borderRadius: 10, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Back to Concept
            </button>
            <button
              onClick={() => onNavigate("coding")}
              style={{ padding: "10px 24px", borderRadius: 10, background: "none", border: `1px solid #d9f36e`, color: "#555555", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {Ico.code(13)} Start Coding Task
            </button>
          </div>
        </div>
      ) : (
        /* ── Question card ── */
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 28px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 14 }}>
              Question {currentQ + 1}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 24px", lineHeight: 1.5 }}>
              {q.question}
            </h2>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {q.options.map((opt, i) => {
                const isSelected = selected === i;
                const isCorrect = i === q.correct_index;
                let bg = C.surface;
                let border = C.border;
                let textColor = C.text;

                if (submitted) {
                  if (isCorrect) { bg = "#edffd6"; border = "#d9f36e"; textColor = "#222222"; }
                  else if (isSelected && !isCorrect) { bg = "rgba(220,38,38,0.08)"; border = "rgba(220,38,38,0.4)"; textColor = C.red; }
                  else { bg = C.surface; border = C.border; textColor = C.textDim; }
                } else if (isSelected) {
                  bg = "#f7ffe0"; border = "#d9f36e"; textColor = "#222222";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 10,
                      background: bg, border: `1.5px solid ${border}`,
                      cursor: submitted ? "default" : "pointer",
                      textAlign: "left" as const, transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: submitted && isCorrect ? "#d9f36e" : submitted && isSelected && !isCorrect ? "rgba(220,38,38,0.15)" : isSelected ? "#d9f36e" : C.border,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, color: "#222222",
                    }}>
                      {submitted && isCorrect ? "✓" : submitted && isSelected && !isCorrect ? "✗" : String.fromCharCode(65 + i)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: textColor, lineHeight: 1.5 }}>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explanation (shown after submit) */}
          {submitted && (
            <div style={{ background: "#f7ffe0", border: `1px solid #d9f36e`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#555555", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
                {selected === q.correct_index ? "✓ Correct!" : "✗ Incorrect"} — Explanation
              </div>
              <p style={{ fontSize: 13, color: "#444444", margin: 0, lineHeight: 1.7 }}>{q.explanation}</p>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={selected === null}
                style={{
                  padding: "10px 28px", borderRadius: 10,
                  background: selected !== null ? C.purple : C.border,
                  border: "none", color: selected !== null ? C.white : C.textDim,
                  fontSize: 13, fontWeight: 700, cursor: selected !== null ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                }}
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                style={{ padding: "10px 28px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {currentQ < activeQuestions.length - 1 ? "Next Question →" : "See Results"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  MAIN PAGE COMPONENT
 * ───────────────────────────────────────────────────────────────────────────── */
type Screen = "plan" | "foundation" | "curriculum" | "topic" | "concept" | "simulation" | "coding" | "quiz";

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface NavState {
  screen: Screen;
  topicTitle?: string;
  topicDay?: number;
  topicTasks?: LearningTask[];
  conceptTitle?: string;
  parentTopic?: string;
  conceptTask?: LearningTask | null;
  quizTopic?: string;
  quizQuestions?: QuizQuestion[];
  foundationTab?: "overview" | "topics" | "gaps" | "quiz";
}

export default function StudyPlanPage() {
  const router = useRouter();

  // ── Session state ──
  const [studentId, setStudentId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [company, setCompany] = useState("Google");
  const [role, setRole] = useState("Senior L5 Backend");

  // ── Plan state ──
  const [dynamicPlan, setDynamicPlan] = useState<PlanDetailResponse | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Navigation state ──
  const [nav, setNav] = useState<NavState>({ screen: "plan" });

  // ── Feedback modal ──
  const [showFeedback, setShowFeedback] = useState(false);

  // ── Countdown (days left) ──
  const [daysLeft, setDaysLeft] = useState(14);

  // ── Load session ──
  useEffect(() => {
    const sid = sessionStorage.getItem("student_id");
    const tid = sessionStorage.getItem("target_id");
    const co = sessionStorage.getItem("company_name");
    const ro = sessionStorage.getItem("role");
    const iDate = sessionStorage.getItem("interview_date");

    if (!sid) { router.replace("/login"); return; }
    setStudentId(Number(sid));
    if (tid) setTargetId(Number(tid));
    if (co) setCompany(co);
    if (ro) setRole(ro);

    if (iDate) {
      const diff = Math.ceil((new Date(iDate).getTime() - Date.now()) / 86400000);
      setDaysLeft(Math.max(0, diff));
    }
  }, [router]);

  // ── Load plan ──
  useEffect(() => {
    if (!studentId || !targetId) return;
    (async () => {
      try {
        const status = await getPrepStatus(studentId, targetId);
        if (status.status === "ready") {
          const plan = await getLatestPrep(studentId, targetId);
          setDynamicPlan(plan);
          setPlanStatus("ready");
        } else if (status.status === "generating") {
          setPlanStatus("generating");
          startPolling(studentId, targetId);
        } else {
          setPlanStatus("idle");
        }
      } catch {
        setPlanStatus("idle");
      }
    })();
    return () => stopPolling();
  }, [studentId, targetId]);

  const startPolling = useCallback((sid: number, tid: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPrepStatus(sid, tid);
        if (status.status === "ready") {
          stopPolling();
          const plan = await getLatestPrep(sid, tid);
          setDynamicPlan(plan);
          setPlanStatus("ready");
        } else if (status.status === "failed") {
          stopPolling();
          setPlanStatus("failed");
          setPlanError("Plan generation failed. Please try again.");
        }
      } catch {
        // keep polling
      }
    }, 3000);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleGenerate = async () => {
    if (!studentId) return;
    setPlanStatus("generating");
    setPlanError(null);
    try {
      await generatePrep(studentId);
      if (targetId) startPolling(studentId, targetId);
    } catch (e: unknown) {
      setPlanStatus("failed");
      setPlanError(e instanceof Error ? e.message : "Failed to generate plan.");
    }
  };

  const handleReset = async () => {
    if (!studentId || !targetId) return;
    try {
      await resetPrepPlan(studentId, targetId);
      setDynamicPlan(null);
      setPlanStatus("idle");
    } catch {
      // silent
    }
  };

  // ── Navigation helper ──
  const navigate = (screen: string, extra?: Record<string, unknown>) => {
    setNav({ screen: screen as Screen, ...extra } as NavState);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Readiness score (derived from plan progress) ──
  const readinessPct = dynamicPlan ? 72 : 0;

  // ── Render ──
  const renderScreen = () => {
    switch (nav.screen) {
      case "plan":
        return (
          <Screen1PrepPlan
            dynamicPlan={dynamicPlan}
            company={company}
            role={role}
            daysLeft={daysLeft}
            readinessPct={readinessPct}
            onNavigate={navigate}
            onRegenerate={handleGenerate}
            onReset={handleReset}
            generating={planStatus === "generating"}
          />
        );
      case "foundation":
        return (
          <Screen0Foundation
            company={company}
            role={role}
            dynamicPlan={dynamicPlan}
            initialTab={nav.foundationTab ?? "overview"}
            onNavigate={navigate}
          />
        );
      case "curriculum":
        return <Screen2Curriculum onNavigate={navigate} />;
      case "topic":
        return (
          <Screen3TopicDetail
            topicTitle={nav.topicTitle || "Advanced Concurrency"}
            topicTasks={nav.topicTasks || []}
            quizQuestions={nav.quizQuestions}
            onNavigate={navigate}
          />
        );
      case "concept":
        return (
          <Screen4ConceptDetail
            conceptTitle={nav.conceptTitle || "Java Memory Model"}
            parentTopic={nav.parentTopic || "Advanced Concurrency"}
            conceptTask={nav.conceptTask}
            quizQuestions={nav.quizQuestions}
            onNavigate={navigate}
          />
        );
      case "simulation":
        return <Screen5Simulation onNavigate={navigate} />;
      case "coding":
        return <Screen6Coding onNavigate={navigate} />;
      case "quiz":
        return (
          <Screen7Quiz
            quizTopic={nav.quizTopic || "Technical Quiz"}
            quizQuestions={nav.quizQuestions}
            onNavigate={navigate}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          fontFamily: "'Inter', 'DM Sans', sans-serif",
          padding: nav.screen === "coding" ? "24px 24px 0" : "32px 24px 48px",
        }}
      >


        {/* ── Error banner ── */}
        {planError && (
          <div style={{ maxWidth: 900, margin: "0 auto 20px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.red }}>{planError}</span>
            <button onClick={() => setPlanError(null)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>{Ico.x(14)}</button>
          </div>
        )}

        {/* ── No plan state ── */}
        {nav.screen === "plan" && planStatus === "idle" && !dynamicPlan && (
          <div style={{ maxWidth: 900, margin: "0 auto 24px" }}>
            <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>No prep plan yet</h3>
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Generate a personalized AI-powered study plan based on your target role and JD.</p>
              </div>
              <button
                onClick={handleGenerate}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
              >
                {Ico.zap(14)} Generate Plan
              </button>
            </div>
          </div>
        )}

        {/* ── Screen content ── */}
        {renderScreen()}

        {/* ── Feedback Modal ── */}
        {showFeedback && studentId && (
          <FeedbackModal
            interview={{ company_name: company, role, interview_date: new Date().toISOString().split("T")[0] }}
            studentId={studentId}
            onClose={() => setShowFeedback(false)}
            onSubmitted={() => setShowFeedback(false)}
          />
        )}
      </div>
    </>
  );
}
