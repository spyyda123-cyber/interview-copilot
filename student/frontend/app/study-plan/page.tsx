"use client";

import dynamic from "next/dynamic";
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "100%", background: "#f3f3f3", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#888888", fontSize: 12 }}>Loading editor...</span>
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
  getTopicContent,
  type TopicContent,
  type PlanDetailResponse,
  type DailyPlanItem,
  type LearningTask,
} from "@/src/lib/api";

/* -----------------------------------------------------------------------------
 *  GLOBAL STYLES
 * ----------------------------------------------------------------------------- */
const globalStyles = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .sp-fade-up { animation: fadeInUp 0.35s ease both; }
  .sp-scroll::-webkit-scrollbar { width: 4px; }
  .sp-scroll::-webkit-scrollbar-track { background: transparent; }
  .sp-scroll::-webkit-scrollbar-thumb { background: #d9f36e; border-radius: 10px; }
`;

/* -----------------------------------------------------------------------------
 *  DESIGN TOKENS  &mdash; lime / black / white theme
 *  #d9f36e  lime accent
 *  #222222  near-black text & dark elements
 *  #ffffff  white cards
 *  #f3f3f3  light gray background
 * ----------------------------------------------------------------------------- */
const C = {
  bg:          "#f3f3f3",
  surface:     "#f3f3f3",
  card:        "#ffffff",
  cardHover:   "#f3f3f3",
  border:      "#e8e8e8",
  borderLight: "#ececec",
  purple:      "#222222",       // primary action color -> near-black
  purpleLight: "#444444",       // secondary text
  purpleDim:   "#f3f3f3",       // subtle bg for highlighted areas
  purpleBg:    "#f3f3f3",       // section backgrounds
  green:       "#222222",       // success -> use dark
  greenBg:     "#edffd6",       // lime-tinted bg
  greenLight:  "#d9f36e",       // lime accent
  amber:       "#555555",
  amberBg:     "#f3f3f3",
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

/* -----------------------------------------------------------------------------
 *  SVG ICONS
 * ----------------------------------------------------------------------------- */
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

/* -----------------------------------------------------------------------------
 *  SMALL REUSABLE COMPONENTS
 * ----------------------------------------------------------------------------- */
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

/* -----------------------------------------------------------------------------
 *  SCREEN 0A &mdash; FOUNDATION (Phase 1 &mdash; from AI roadmap_stages description)
 * ----------------------------------------------------------------------------- */
function Screen0Foundation({
  company,
  role,
  dynamicPlan,
  studentId,
  onNavigate,
  getTopicProgress,
  markTopicStarted,
}: {
  company: string;
  role: string;
  dynamicPlan: PlanDetailResponse | null;
  studentId?: number | null;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
  markTopicStarted: (topicId: string) => void;
}) {
  // Get foundation stage description from AI
  const foundationStage = dynamicPlan?.plan_json?.roadmap_stages?.find(
    s => s.id?.includes("foundation") || s.title?.toLowerCase().includes("foundation")
  );

  // Get student's actual skills from sessionStorage (set during onboarding)
  const primarySkill = typeof window !== "undefined" ? sessionStorage.getItem("primary_skill") ?? "" : "";
  const knownSkillsRaw = typeof window !== "undefined" ? sessionStorage.getItem("known_skills") ?? "[]" : "[]";
  let knownSkills: Array<{skill: string; proficiency: string}> = [];
  try { knownSkills = JSON.parse(knownSkillsRaw); } catch { knownSkills = []; }

  // Build foundation topics from AI curriculum — prefer stage_id="foundation" topics first,
  // then fall back to advanced/intermediate proficiency tags, then sessionStorage known skills
  const allTopics = (dynamicPlan?.plan_json?.curriculum ?? []).flatMap(c => c.topics);

  // Primary: topics the AI explicitly placed in the foundation stage
  let profileSkillTopics = allTopics.filter(t => t.stage_id === "foundation");

  // Fallback 1: topics tagged advanced or intermediate (student already knows them)
  if (profileSkillTopics.length === 0) {
    profileSkillTopics = allTopics.filter(
      t => t.proficiency_tag === "advanced" || t.proficiency_tag === "intermediate"
    );
  }

  // Fallback 2: fuzzy match against sessionStorage known_skills
  if (profileSkillTopics.length === 0 && knownSkills.length > 0) {
    profileSkillTopics = allTopics.filter(t =>
      knownSkills.some(ks =>
        t.title.toLowerCase().includes(ks.skill.toLowerCase()) ||
        ks.skill.toLowerCase().includes(t.title.toLowerCase())
      )
    );
  }

  // Fallback 3: inject primary skill match if not already present
  if (primarySkill && !profileSkillTopics.some(t => t.title.toLowerCase().includes(primarySkill.toLowerCase()))) {
    const matched = allTopics.find(t => t.title.toLowerCase().includes(primarySkill.toLowerCase()));
    if (matched) profileSkillTopics.unshift(matched);
  }

  const foundationTopics = profileSkillTopics;
  const weakAreas = dynamicPlan?.plan_json?.weak_areas ?? [];

  // Compute avg mastery from proficiency tags
  const profToMastery = (tag: string) => tag === "advanced" ? 80 : tag === "intermediate" ? 50 : 15;
  const avgMastery = foundationTopics.length > 0
    ? Math.round(foundationTopics.reduce((s, t) => s + profToMastery(t.proficiency_tag), 0) / foundationTopics.length)
    : 0;

  const foundationQuizQuestions = [
    {
      question: "What is the time complexity of searching in a balanced Binary Search Tree...",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correct_index: 1,
      explanation: "A balanced BST has height O(log n), so search, insert, and delete all run in O(log n).",
    },
    {
      question: "Which data structure uses LIFO ordering...",
      options: ["Queue", "Stack", "Linked List", "Hash Table"],
      correct_index: 1,
      explanation: "A Stack follows LIFO &mdash; the last element pushed is the first to be popped.",
    },
    {
      question: "What is the average time complexity of insertion in a Hash Table...",
      options: ["O(n)", "O(log n)", "O(1)", "O(n&sup2;)"],
      correct_index: 2,
      explanation: "Hash tables provide O(1) average-case insertion, lookup, and deletion.",
    },
    {
      question: "Which sorting algorithm guarantees O(n log n) in all cases...",
      options: ["Quick Sort", "Merge Sort", "Bubble Sort", "Insertion Sort"],
      correct_index: 1,
      explanation: "Merge Sort guarantees O(n log n) in best, average, and worst cases.",
    },
    {
      question: "In a graph with V vertices and E edges, what is the space complexity of an adjacency list...",
      options: ["O(V)", "O(E)", "O(V + E)", "O(V &times; E)"],
      correct_index: 2,
      explanation: "An adjacency list stores each vertex once (O(V)) and each edge once or twice (O(E)), giving O(V + E).",
    },
  ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <button
            onClick={() => onNavigate("plan")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}
          >
            {Ico.arrowLeft(12)} Back to Plan
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight }}>{company}</span>
            <span style={{ color: C.textDim }}>&bull;</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>{role}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>Foundation</h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            {foundationStage?.description ?? "Phase 1 &mdash; Baseline assessment of your existing skills against the target JD."}
          </p>
        </div>
        {avgMastery > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.purpleLight, lineHeight: 1 }}>{avgMastery}%</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.textDim, marginTop: 1, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Avg Mastery</div>
          </div>
        )}
      </div>

      {/* Summary banner */}
      <div style={{ background: C.greenBg, border: `1px solid ${C.greenLight}`, borderRadius: 14, padding: "18px 22px", marginBottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: C.greenBg, border: `2px solid ${C.greenLight}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {Ico.check(18, C.greenLight)}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            Phase 1 Complete &mdash; {foundationTopics.length > 0 ? `${foundationTopics.length} topics assessed` : "Baseline assessment done"}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {foundationTopics.length > 0
              ? `Your existing skills: ${foundationTopics.map(t => t.title).slice(0, 4).join(", ")}${foundationTopics.length > 4 ? ` +${foundationTopics.length - 4} more` : ""}`
              : "Skills assessed against the target JD requirements."}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
          {foundationTopics.length > 0 && <Badge label={`${foundationTopics.length} Topics`} color={C.purpleLight} bg={C.purpleDim} />}
          <Badge label="Phase 1 &#10003;" color={C.greenLight} bg={C.greenBg} />
        </div>
      </div>

      {/* AI-derived topic grid &mdash; topics student already has some proficiency in */}
      {foundationTopics.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>Your Existing Skills</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 32 }}>
            {foundationTopics.map((topic, i) => {
              const baseMastery = profToMastery(topic.proficiency_tag);
              const progress = getTopicProgress(topic.id);
              // Real mastery: completed = 100%, started = base mastery, not_started = base mastery
              const displayMastery = progress === "completed" ? 100 : baseMastery;
              const isCompleted = progress === "completed";
              const isStarted = progress === "started";
              return (
                <div key={i} style={{ background: C.card, border: `1px solid ${isCompleted ? C.greenLight : C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{topic.title}</h4>
                    {isCompleted ? (
                      <Badge label="Completed ✓" color={C.greenLight} bg={C.greenBg} />
                    ) : isStarted ? (
                      <Badge label="In Progress" color={C.purpleLight} bg={C.purpleDim} />
                    ) : (
                      <Badge
                        label={topic.proficiency_tag === "advanced" ? "Advanced" : topic.proficiency_tag === "intermediate" ? "Intermediate" : "Beginner"}
                        color={topic.proficiency_tag === "advanced" ? C.greenLight : C.amber}
                        bg={topic.proficiency_tag === "advanced" ? C.greenBg : C.amberBg}
                      />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 10px", lineHeight: 1.5 }}>{topic.description}</p>
                  <ProgressBar pct={displayMastery} color={isCompleted ? C.greenLight : topic.proficiency_tag === "advanced" ? C.greenLight : C.amber} height={5} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: C.textDim }}>{displayMastery}% mastery</span>
                    <button
                      onClick={() => { markTopicStarted(topic.id); onNavigate("topic", { topicTitle: topic.title, topicId: topic.id }); }}
                      style={{ fontSize: 11, fontWeight: 700, color: C.purpleLight, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {isCompleted ? "Review Again" : isStarted ? "Continue" : "Review"} {Ico.arrowRight(10)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 12, padding: "16px 20px", marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            No existing skills matched at Advanced or Intermediate level for this role. Focus on the Core Prep topics in Phase 2.
          </p>
        </div>
      )}

      {/* Foundation Quiz CTA */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 26px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#127919;</div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>Foundation Mastery Quiz</h3>
        <p style={{ fontSize: 13, color: C.textMuted, margin: "0 auto 18px", maxWidth: 440, lineHeight: 1.6 }}>
          Test your understanding of core DSA fundamentals with 5 mixed-difficulty questions.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
          <Badge label="5 Questions" color={C.purpleLight} bg={C.purpleDim} />
          <Badge label="~10 min" color={C.textMuted} bg={C.surface} />
        </div>
        <button
          onClick={() => onNavigate("quiz", { quizTopic: "Foundation Mastery", quizQuestions: foundationQuizQuestions })}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {Ico.play(13)} Start Foundation Quiz
        </button>
      </div>
    </div>
  );
}

/* Screen0GapAnalysis removed — gap identification section no longer shown in UI */

/* -----------------------------------------------------------------------------
 *  SCREEN 1 &mdash; PREP PLAN (TARGET READINESS)
 * ----------------------------------------------------------------------------- */

/* -----------------------------------------------------------------------------
 *  SCREEN 1 &mdash; PREP PLAN (TARGET READINESS)
 * ----------------------------------------------------------------------------- */
function Screen1PrepPlan({
  dynamicPlan,
  company,
  role,
  daysLeft,
  readinessPct,
  onNavigate,
  generating,
  studentId,
  getTopicProgress,
}: {
  dynamicPlan: PlanDetailResponse | null;
  company: string;
  role: string;
  daysLeft: number;
  readinessPct: number;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  generating: boolean;
  studentId: number | null;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
}) {
  // Support both new curriculum format and legacy daily_plan format
  const isNewFormat = !!(dynamicPlan?.plan_json?.curriculum);
  const dailyPlan: DailyPlanItem[] = dynamicPlan?.plan_json?.daily_plan ?? [];
  const curriculum = dynamicPlan?.plan_json?.curriculum ?? [];
  const highRoiIds = dynamicPlan?.plan_json?.high_roi_topic_ids ?? [];
  const readinessFromPlan = dynamicPlan?.plan_json?.target_readiness_score;

  // AI-generated roadmap stages (from Prompt 1 output)
  // Filter out any legacy gap/gaps-identification stages — removed from product
  const rawStages = (dynamicPlan?.plan_json?.roadmap_stages ?? []).filter(
    s => !((s.id ?? "").toLowerCase().includes("gap") || (s.title ?? "").toLowerCase().includes("gap"))
  );

  // Real progress tracking via localStorage
  // Students mark stages complete by clicking topics and completing quizzes
  const getStageProgress = (stageId: string): "completed" | "active" | "locked" => {
    if (typeof window === "undefined") return "locked";
    const key = `stage_progress_${studentId}_${stageId}`;
    const stored = localStorage.getItem(key);
    if (stored === "completed") return "completed";
    return "locked";
  };

  // Derive stage statuses:
  // Foundation & Gaps: "completed" only if student has explicitly viewed them (tracked in localStorage)
  // OR if plan exists and student has started topics (proficiency_tag shows existing skills)
  const hasExistingSkills = curriculum.flatMap(c => c.topics).some(
    t => t.proficiency_tag === "advanced" || t.proficiency_tag === "intermediate"
  );

  const aiStages = rawStages.map((stage) => {
    const id = (stage.id ?? "").toLowerCase();
    let derivedStatus: "completed" | "active" | "locked" = "locked";
    const sid = studentId ?? "anon";

    if (id.includes("foundation")) {
      // Foundation: completed after quiz done
      const quizDone = typeof window !== "undefined" && localStorage.getItem(`foundation_quiz_done_${sid}`) === "true";
      derivedStatus = quizDone ? "completed" : "active";
    } else if (id.includes("core-prep") || id.includes("core_prep") || id.includes("high-roi") || id.includes("high_roi") || id.includes("roi")) {
      // Core Prep: completed when all high_roi topics are completed
      const allTopics = curriculum.flatMap(cat => cat.topics);
      const corePrepTopics = highRoiIds.length > 0
        ? highRoiIds.map(tid => allTopics.find(t => t.id === tid)).filter(Boolean) as typeof allTopics
        : allTopics.filter(t => t.roi_label === "high").slice(0, 4);
      const allDone = corePrepTopics.length > 0 && corePrepTopics.every(t => getTopicProgress(t.id) === "completed");
      const anyStarted = corePrepTopics.some(t => getTopicProgress(t.id) !== "not_started");
      derivedStatus = allDone ? "completed" : "active";
    } else if (id.includes("system") || id.includes("design")) {
      derivedStatus = "active";
    } else if (id.includes("behavioral") || id.includes("leadership")) {
      derivedStatus = "active";
    } else {
      derivedStatus = "active";
    }
    return { ...stage, status: derivedStatus };
  });

  // Normalize legacy stage titles so old plans display the new names
  const normalizedStages = aiStages.map(stage => {
    const titleLower = (stage.title ?? "").toLowerCase();
    if (titleLower.includes("high-roi") || titleLower.includes("high roi")) {
      return { ...stage, title: "Core Prep" };
    }
    return stage;
  });

  // proficiency_tag -> mastery % mapping (v1.1 spec)
  const proficiencyToMastery = (tag: string): number => {
    switch (tag) {
      case "advanced": return 80;
      case "intermediate": return 50;
      case "beginner": return 15;
      default: return 0; // missing
    }
  };

  // Build topic cards from high_roi_topic_ids (new format) or daily_plan (legacy)
  const topicCards = isNewFormat
    ? (() => {
        const allTopics = curriculum.flatMap(cat => cat.topics);
        const highRoiTopics = highRoiIds.length > 0
          ? highRoiIds.map(id => allTopics.find(t => t.id === id)).filter(Boolean) as typeof allTopics
          : allTopics.filter(t => t.roi_label === "high").slice(0, 4);
        return highRoiTopics.slice(0, 4).map((topic) => {
          const progress = getTopicProgress(topic.id);
          const key = `coding_pct_${studentId}_${topic.id}`;
          const storedPct = (typeof window !== "undefined" && studentId) ? localStorage.getItem(key) : null;
          const progressPct = progress === "completed" ? 100 : (storedPct ? parseInt(storedPct) : (progress === "started" ? 40 : 0));
          return {
            title: topic.title,
            status: progress === "completed" ? "completed" : (progress === "started" || storedPct ? "in-progress" : "queued"),
            progress: progressPct,
            day: 1,
            tasks: [] as LearningTask[],
            allQuizQuestions: [] as Array<{question: string; options: string[]; correct_index: number; explanation: string}>,
            topicId: topic.id,
            description: topic.description,
            difficulty: topic.difficulty,
            subTopics: topic.sub_topics,
          };
        });
      })()
    : dailyPlan.slice(0, 4).map((day, i) => ({
        title: day.focus,
        status: i === 0 ? "in-progress" : "queued",
        progress: i === 0 ? 45 : 0,
        day: day.day,
        tasks: day.tasks,
        allQuizQuestions: day.tasks.flatMap(t => t.quiz ?? []),
        topicId: day.focus.toLowerCase().replace(/\s+/g, "-"),
        description: "",
        difficulty: "medium" as const,
        subTopics: [] as Array<{id: string; title: string}>,
      }));

  return (
    <div className="sp-fade-up" style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* -- Header -- */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight }}>{company || "Google"}</span>
            <span style={{ color: C.textDim }}>&bull;</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>{role || "Senior L5 Backend"}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.5px" }}>
            Target Readiness
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Readiness score */}
          <div style={{ textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.purpleLight, lineHeight: 1 }}>{readinessPct}%</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.textDim, marginTop: 1, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Readiness</div>
          </div>
          {/* Days left */}
          <div style={{ textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.amber, lineHeight: 1 }}>{daysLeft}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.textDim, marginTop: 1, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Days Left</div>
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

      {/* ── Timeline — driven by AI roadmap_stages[] ── */}
      <div style={{ position: "relative" as const }}>
        {/* Vertical line */}
        <div style={{ position: "absolute" as const, left: 19, top: 24, bottom: 24, width: 2, background: `linear-gradient(to bottom, ${C.green}, ${C.purple}, ${C.border})`, borderRadius: 2 }} />

        {/* Render AI roadmap stages if available, else show default 5-stage structure */}
        {normalizedStages.length > 0 ? normalizedStages.map((stage, i) => {
          const isFoundation = stage.id === "foundation" || stage.title.toLowerCase().includes("foundation");
          const isCorePrepStage = stage.id === "core-prep" || stage.title.toLowerCase().includes("core prep") || stage.title.toLowerCase().includes("core-prep") || stage.id === "high-roi" || stage.id === "high-roi-topics";
          const isSysDesign = stage.id === "system-design" || stage.id === "system-design-phase" || stage.title.toLowerCase().includes("system design");
          const isBehavioral = stage.id === "behavioral" || stage.id === "behavioral-leadership" || stage.title.toLowerCase().includes("behavioral") || stage.title.toLowerCase().includes("leadership");

          return (
            <PhaseRow
              key={stage.id}
              index={i + 1}
              title={stage.title}
              status={stage.status as "completed" | "active" | "locked"}
              description={stage.description}
              onClick={
                isFoundation ? () => onNavigate("foundation") :
                isSysDesign ? () => onNavigate("simulation") :
                isBehavioral ? () => onNavigate("behavioral") :
                undefined
              }
              extra={isCorePrepStage ? (
                <div style={{ marginTop: 14 }}>
                  {topicCards.length === 0 ? (
                    <div style={{ color: C.textDim, fontSize: 13 }}>
                      {generating ? "Generating topics..." : "No topics yet."}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {topicCards.map((tc, j) => (
                        <TopicCard
                          key={j}
                          title={tc.title}
                          status={tc.status as "in-progress" | "queued" | "completed"}
                          progress={tc.progress}
                          onClick={() => onNavigate("topic", {
                            topicTitle: tc.title,
                            topicId: tc.topicId,
                            topicDay: tc.day,
                            topicTasks: tc.tasks,
                            quizQuestions: tc.allQuizQuestions,
                          })}
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
              ) : undefined}
            />
          );
        }) : (
          <>
            {/* Default 4-stage structure when no AI plan yet */}
            <PhaseRow index={1} title="Foundation" status="active"
              description="Baseline assessment of your existing skills against the target JD."
              onClick={() => onNavigate("foundation")} />
            <PhaseRow index={2} title="Core Prep" status="active" description=""
              extra={
                <div style={{ marginTop: 14 }}>
                  {topicCards.length === 0 ? (
                    <div style={{ color: C.textDim, fontSize: 13 }}>
                      {generating ? "Generating topics..." : "No topics yet. Generate a plan to get started."}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {topicCards.map((tc, i) => (
                        <TopicCard key={i} title={tc.title}
                          status={tc.status as "in-progress" | "queued" | "completed"}
                          progress={tc.progress}
                          onClick={() => onNavigate("topic", { topicTitle: tc.title, topicId: tc.topicId, topicDay: tc.day, topicTasks: tc.tasks, quizQuestions: tc.allQuizQuestions })}
                        />
                      ))}
                    </div>
                  )}
                  <button onClick={() => onNavigate("curriculum")}
                    style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Explore More {Ico.arrowRight(12)}
                  </button>
                </div>
              }
            />
            <PhaseRow index={3} title="System Design" status="locked"
              description="End-to-end system design practice tailored to your target company engineering scale and interview format."
              onClick={() => onNavigate("simulation")} />
            <PhaseRow index={4} title="Behavioral & Leadership" status="locked"
              description="Final phase — communication, leadership, and culture fit." />
          </>
        )}
      </div>

      {/* ── AI Overview — show plan_summary if available, else overview ── */}
      {dynamicPlan?.plan_json?.overview && (
        <div style={{ marginTop: 28, background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {Ico.lightbulb(14)}
            <span style={{ fontSize: 11, fontWeight: 700, color: C.purpleLight, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>AI Overview</span>
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>
            {dynamicPlan.plan_json.overview}
          </p>
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
  status: "in-progress" | "queued" | "completed";
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
        border: `1px solid ${status === "completed" ? C.greenLight : (hovered ? C.purple : C.border)}`,
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{title}</span>
        {status === "completed" ? (
          <Badge label="Completed ✓" color={C.greenLight} bg={C.greenBg} />
        ) : status === "in-progress" ? (
          <Badge label="In Progress" color={C.purpleLight} bg={C.purpleDim} />
        ) : (
          <Badge label="Queued" color={C.textDim} bg={C.surface} />
        )}
      </div>
      {status === "completed" || status === "in-progress" ? (
        <>
          <ProgressBar pct={progress} color={status === "completed" ? C.greenLight : C.purple} />
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

/* -----------------------------------------------------------------------------
 *  SCREEN 2 &mdash; CURRICULUM LIBRARY
 * ----------------------------------------------------------------------------- */
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
          <Badge label="CORE PREP" color={C.purpleLight} bg={C.purpleDim} />
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
            <Badge label="NEW TRACK &bull; 12 Topics" color="#222222" bg="rgba(217,243,110,0.4)" />
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

/* -----------------------------------------------------------------------------
 *  SCREEN 3 &mdash; TOPIC DETAIL (Prompt 2 &mdash; Topic Learning Engine)
 * ----------------------------------------------------------------------------- */
function Screen3TopicDetail({
  topicTitle,
  topicId,
  topicTasks,
  quizQuestions,
  onNavigate,
  markTopicStarted,
  markTopicCompleted,
  getTopicProgress,
}: {
  topicTitle: string;
  topicId?: string;
  topicTasks: LearningTask[];
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  markTopicStarted: (topicId: string) => void;
  markTopicCompleted: (topicId: string) => void;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
}) {
  const [topicContent, setTopicContent] = useState<TopicContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mark topic as started when opened
  useEffect(() => {
    if (topicId) markTopicStarted(topicId);
  }, [topicId]);

  // Load Prompt 2 content when topic is opened
  useEffect(() => {
    if (!topicId) return;
    const studentId = sessionStorage.getItem("student_id");
    const targetId = sessionStorage.getItem("target_id");
    if (!studentId || !targetId) return;

    setLoading(true);
    setError(null);
    getTopicContent(Number(studentId), topicId, Number(targetId))
      .then(content => {
        setTopicContent(content);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load topic content. Please try again.");
        setLoading(false);
      });
  }, [topicId]);

  // Use AI content or fallback
  const coreConcepts = topicContent?.core_concepts?.length
    ? topicContent.core_concepts.map(c => ({
        id: c.id,
        title: c.title,
        desc: c.summary,
        content: c.content,
      }))
    : [
        { id: "concept-1", title: "Core Concept 1", desc: "Loading AI content...", content: null },
        { id: "concept-2", title: "Core Concept 2", desc: "Loading AI content...", content: null },
        { id: "concept-3", title: "Core Concept 3", desc: "Loading AI content...", content: null },
      ];

  const traps = topicContent?.interview_traps?.length
    ? topicContent.interview_traps.map(t => t.title + " &mdash; " + t.description)
    : ["Loading interview traps from AI..."];

  const practiceItems = topicContent?.practice_tasks?.length
    ? topicContent.practice_tasks.slice(0, 3).map(t => ({
        title: t.title,
        duration: t.duration_minutes,
        taskType: t.task_type,
        taskId: t.id,
      }))
    : topicTasks.slice(0, 3).map(t => ({
        title: t.title,
        duration: t.duration_minutes,
        taskType: t.task_type,
        taskId: "",
      }));

  const difficulty = topicContent?.difficulty ?? "medium";
  const frequencyLabel = topicContent?.frequency_label ?? "High Frequency";
  const strategicInsights = topicContent?.strategic_insights ?? "Loading strategic insights from AI...";

  // Build quiz questions from Prompt 2 output
  const aiQuizQuestions = topicContent?.quiz?.map(q => ({
    question: q.question_text,
    options: q.options,
    correct_index: q.correct_option_index,
    explanation: q.explanation,
  })) ?? quizQuestions ?? [];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Breadcrumb
        items={[
          { label: "Prep Plan", screen: "plan" },
          { label: "Core Prep", screen: "plan" },
          { label: topicTitle },
        ]}
        onNavigate={onNavigate}
      />

      {/* Loading state */}
      {loading && (
        <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 12, padding: "20px 22px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 18, height: 18, border: `2px solid ${C.purpleLight}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.purpleLight, fontWeight: 600 }}>Generating deep-dive content for {topicTitle}…</span>
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, margin: 0, paddingLeft: 30 }}>
            AI is building core concepts, interview traps, practice tasks and quiz. This takes 30–60 seconds on first load — cached instantly after.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, color: C.red }}>{error}</span>
          <button
            onClick={() => {
              const studentId = sessionStorage.getItem("student_id");
              const targetId = sessionStorage.getItem("target_id");
              if (!studentId || !targetId || !topicId) return;
              setError(null);
              setLoading(true);
              getTopicContent(Number(studentId), topicId, Number(targetId))
                .then(content => { setTopicContent(content); setLoading(false); })
                .catch(() => { setError("Still failing. Check your connection and try again."); setLoading(false); });
            }}
            style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, background: C.red, color: "#fff", border: "none", cursor: "pointer", flexShrink: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Tags + Title */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Badge label={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} color={difficulty === "hard" ? C.red : difficulty === "medium" ? C.amber : "#22aa55"} bg={difficulty === "hard" ? "rgba(220,38,38,0.12)" : C.amberBg} />
        <Badge label={frequencyLabel} color={C.amber} bg={C.amberBg} />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{topicTitle}</h1>

      {/* Mastery bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Mastery Level</span>
          <span style={{ fontSize: 12, color: C.purpleLight, fontWeight: 700 }}>
            {topicId ? (getTopicProgress(topicId) === "completed" ? "100%" : getTopicProgress(topicId) === "started" ? "In Progress" : "0%") : "0%"}
          </span>
        </div>
        <ProgressBar
          pct={topicId ? (getTopicProgress(topicId) === "completed" ? 100 : getTopicProgress(topicId) === "started" ? 40 : 0) : 0}
          color={topicId && getTopicProgress(topicId) === "completed" ? C.greenLight : C.purple}
          height={6}
        />
      </div>

      {/* Strategic Insights &mdash; AI generated */}
      <div style={{ background: `linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)`, border: `1px solid #d9f36e`, borderRadius: 14, padding: "20px 22px", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {Ico.star(14)}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#555555", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Strategic Insights</span>
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>{strategicInsights}</p>
      </div>

      {/* Core Concepts &mdash; from Prompt 2 sub_topics */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Core Concepts</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {coreConcepts.map((c, i) => (
            <div
              key={i}
              onClick={() => !loading && onNavigate("concept", {
                conceptTitle: c.title,
                parentTopic: topicTitle,
                topicId: topicId,
                subTopicId: c.id,
                topicContent: topicContent,
                quizQuestions: aiQuizQuestions,
              })}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px", cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
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
        {/* Interview Traps &mdash; AI generated */}
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

        {/* Active Practice &mdash; AI generated */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
            {Ico.play(14)} Active Practice
          </h3>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 14 }}>
            {practiceItems.map((p, i) => {
              const isCode = p.taskType === "code";
              const studentId = typeof window !== "undefined" ? sessionStorage.getItem("student_id") : null;
              const storedPct = (isCode && studentId && topicId) ? localStorage.getItem(`coding_pct_${studentId}_${topicId}`) : null;
              const pct = storedPct ? parseInt(storedPct) : 0;

              return (
                <div
                  key={i}
                  onClick={() => onNavigate("coding", {
                    practiceTask: p.taskType === "code" ? topicContent?.practice_tasks?.find(t => t.task_type === "code") ?? null : null,
                    topicId: topicId,
                  })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface, borderRadius: 8, cursor: "pointer" }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: pct === 100 ? "#edffd6" : C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {pct === 100 ? Ico.check(10, C.greenLight) : Ico.play(10)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{p.duration} min</div>
                  </div>
                  {isCode && (
                    <div>
                      {pct === 100 ? (
                        <Badge label="100% Passed" color={C.greenLight} bg={C.greenBg} />
                      ) : pct > 0 ? (
                        <Badge label={`${pct}% Done`} color={C.amber} bg={C.amberBg} />
                      ) : (
                        <Badge label="Not Started" color={C.textDim} bg="rgba(0,0,0,0.03)" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onNavigate("coding", {
              practiceTask: topicContent?.practice_tasks?.find(t => t.task_type === "code") ?? null,
              topicId: topicId,
            })}
            style={{ width: "100%", padding: "8px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            View All Tasks
          </button>
        </div>
      </div>

      {/* Quiz CTA */}
      {aiQuizQuestions.length > 0 && (
        <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>Test Your Understanding</h3>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{aiQuizQuestions.length} AI-generated questions for {topicTitle}</p>
          </div>
          <button
            onClick={() => {
              onNavigate("quiz", {
                quizTopic: topicTitle,
                quizQuestions: aiQuizQuestions,
                onQuizComplete: () => { if (topicId) markTopicCompleted(topicId); },
              });
            }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {Ico.book(13)} Take Quiz
          </button>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 *  SCREEN 4 &mdash; TOPIC DEEP CONTENT (Concept Detail)
 * ----------------------------------------------------------------------------- */
function Screen4ConceptDetail({
  conceptTitle,
  parentTopic,
  conceptTask,
  topicContent,
  subTopicId,
  quizQuestions,
  onNavigate,
}: {
  conceptTitle: string;
  parentTopic: string;
  conceptTask?: LearningTask | null;
  topicContent?: TopicContent | null;
  subTopicId?: string;
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  // Find the specific sub-topic content from Prompt 2 output
  const subTopicContent = topicContent?.core_concepts?.find(
    c => c.id === subTopicId || c.title === conceptTitle
  );

  // Build Core Mechanics from Prompt 2 core_concept.content
  const aiMechanics = subTopicContent?.content
    ? [
        { title: "Intuition", detail: subTopicContent.content.intuition },
        { title: "Core Mechanics", detail: subTopicContent.content.core_mechanics },
        { title: "Real-World Usage", detail: subTopicContent.content.real_world_usage },
        { title: "Tradeoffs", detail: subTopicContent.content.tradeoffs },
      ].filter(m => m.detail)
    : null;

  const mechanics = aiMechanics ?? (conceptTask?.qa_pairs ?? [])
    .filter(qp => qp.question && qp.explanation)
    .map(qp => ({
      title: qp.question,
      detail: qp.explanation.replace(/\n\n/g, " ").replace(/\n/g, " "),
    }));

  // Common pitfalls from Prompt 2 &mdash; no hardcoded fallback
  const commonMistakes = subTopicContent?.content?.common_mistakes
    ? [{ title: "Common Mistake", desc: subTopicContent.content.common_mistakes }]
    : [];

  // Communication tip from Prompt 2
  const communicationTip = subTopicContent?.content?.communication_tip ?? null;

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Top row: breadcrumb left, back button right */}
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
        </div>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>{conceptTitle}</h1>
      {subTopicContent?.content?.intuition && (
        <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, marginBottom: 28, maxWidth: 700 }}>
          {subTopicContent.content.intuition}
        </p>
      )}

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
              <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>{m.title}</h4>
              <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.75 }}>{m.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/*
 *  SCREEN 5 (placeholder for next section)
 */
function Screen5Simulation({
  onNavigate,
  company,
  role,
  dynamicPlan,
}: {
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  company: string;
  role: string;
  dynamicPlan: PlanDetailResponse | null;
}) {
  const [seconds, setSeconds] = useState(45 * 60);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // -- Pull system design topics from AI curriculum --------------------------
  const allTopics = (dynamicPlan?.plan_json?.curriculum ?? []).flatMap(c => c.topics);
  const sysDesignTopics = allTopics.filter(t =>
    t.id?.includes("system") ||
    t.id?.includes("design") ||
    t.id?.includes("architecture") ||
    t.title?.toLowerCase().includes("system design") ||
    t.title?.toLowerCase().includes("architecture")
  );

  // Get the system design roadmap stage description from AI
  const sysDesignStage = dynamicPlan?.plan_json?.roadmap_stages?.find(
    s => s.id?.includes("system") || s.title?.toLowerCase().includes("system design")
  );

  // Primary system design topic (first one found)
  const primaryTopic = sysDesignTopics[0];

  // Build scenario from AI data or derive from company/role
  const scenarioTitle = primaryTopic?.title ?? `System Design: ${company} Scale`;
  const scenarioDescription = primaryTopic?.description ??
    sysDesignStage?.description ??
    `Design a scalable distributed system for ${company}'s ${role} engineering requirements. Walk me through your high-level architecture, data flow, and key design decisions.`;

  // -- Build architecture nodes from AI sub-topics -------------------------
  const subTopics = primaryTopic?.sub_topics ?? [];
  const defaultNodes = [
    { id: "lb",   label: "Load Balancer", x: 40,  y: 110, color: C.purple },
    { id: "api",  label: "API Gateway",   x: 200, y: 70,  color: C.blue },
    { id: "svc",  label: "Service Layer", x: 200, y: 150, color: C.blue },
    { id: "db",   label: "Database",      x: 390, y: 110, color: C.green },
  ];

  // Map sub-topics to visual nodes (up to 5 nodes)
  const nodeColors = [C.purple, C.blue, C.blue, C.green, C.amber];
  const xPositions = [40, 200, 360, 200, 360];
  const yPositions = [110, 70, 70, 150, 150];
  const dynamicNodes = subTopics.length >= 2
    ? subTopics.slice(0, 5).map((st, i) => ({
        id: st.id,
        label: st.title.length > 12 ? st.title.slice(0, 11) + "..." : st.title,
        x: xPositions[i] ?? 200 + i * 80,
        y: yPositions[i] ?? 110,
        color: nodeColors[i] ?? C.purpleLight,
      }))
    : defaultNodes;

  const nodes = dynamicNodes;
  // Build edges: connect first node to all others in a hub-and-spoke
  const edges = nodes.slice(1).map((n, i) => ({
    from: nodes[0],
    to: n,
  }));

  // -- AI Transcript questions from topic's JD relevance + sub-topics ------
  const aiQuestions: string[] = [];
  if (primaryTopic?.jd_relevance_note) {
    aiQuestions.push(`AI: ${primaryTopic.jd_relevance_note} &mdash; How does your architecture address this...`);
  }
  if (subTopics.length > 0) {
    aiQuestions.push(`AI: Walk me through how you'd handle ${subTopics[0]?.title ?? "scalability"} in this design.`);
  }
  if (subTopics.length > 1) {
    aiQuestions.push(`AI: What tradeoffs would you consider for ${subTopics[1]?.title ?? "data consistency"}...`);
  }
  if (aiQuestions.length === 0) {
    aiQuestions.push(
      `AI: Design a core backend system for ${company}'s ${role} role. Start with the high-level architecture.`,
      `AI: What scaling strategy would you use to handle traffic spikes at ${company}...`,
      "AI: How do you ensure data consistency and fault tolerance in your design..."
    );
  }

  const [transcript] = useState(aiQuestions);

  // -- Other topics to study in this phase ---------------------------------
  const otherSysTopics = sysDesignTopics.slice(1);

  return (
    <div className="sp-fade-up" style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => onNavigate("plan")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {Ico.arrowLeft(12)} Back to Plan
          </button>
          <Badge label="SYSTEM DESIGN PHASE" color={C.purpleLight} bg={C.purpleDim} />
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: C.purpleLight, letterSpacing: "0.1em" }}>
          {fmt(seconds)}
        </div>
      </div>

      {/* Company + Role context banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight }}>{company}</span>
        <span style={{ color: C.textDim }}>&bull;</span>
        <span style={{ fontSize: 13, color: C.textMuted }}>{role}</span>
      </div>

      {/* AI Scenario Card &mdash; Driven by AI curriculum */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purpleBg} 0%, rgba(124,58,237,0.06) 100%)`,
        border: `1px solid ${C.purpleDim}`, borderRadius: 16, padding: "20px 24px", marginBottom: 20,
        display: "flex", alignItems: "flex-start", gap: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
          background: C.purpleDim,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, border: `2px solid ${C.purpleLight}`,
        }}>
          &#127959;
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 6 }}>SYSTEM ARCH AI &mdash; {company.toUpperCase()}</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>{scenarioTitle}</h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 14px", lineHeight: 1.7 }}>
            {scenarioDescription}
          </p>
          {subTopics.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              <span style={{ fontSize: 11, color: C.textDim, marginRight: 4 }}>Key areas:</span>
              {subTopics.map(st => (
                <Badge key={st.id} label={st.title} color={C.purpleLight} bg={C.purpleDim} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Architecture Canvas &mdash; nodes from AI sub-topics */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 20, position: "relative" as const }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>Architecture Canvas &mdash; {scenarioTitle}</div>
        <svg width="100%" height="180">
          {edges.map((e, i) => (
            <line key={i}
              x1={`${(e.from.x / 500) * 100}%`} y1={e.from.y}
              x2={`${(e.to.x / 500) * 100}%`}   y2={e.to.y}
              stroke={C.purpleDim} strokeWidth="1.5" strokeDasharray="5 4"
            />
          ))}
          {nodes.map((n, idx) => (
            <g key={n.id}>
              <rect
                x={`calc(${(n.x / 500) * 100}% - 45px)`} y={n.y - 20}
                width={90} height={38} rx={8}
                fill={C.surface} stroke={n.color} strokeWidth="1.5"
              />
              <text
                x={`${(n.x / 500) * 100}%`} y={n.y + 5}
                textAnchor="middle" fill={C.text} fontSize="11" fontWeight="600"
              >{n.label}</text>
            </g>
          ))}
        </svg>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
          &#128161; Nodes derived from AI-generated sub-topics for <strong>{scenarioTitle}</strong>
        </div>
      </div>

      {/* AI Interview Questions &mdash; from curriculum */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 14 }}>AI Interview Questions &mdash; {company} Style</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {transcript.map((line, i) => (
            <div key={i} style={{
              background: C.purpleBg,
              border: `1px solid ${C.purpleDim}`,
              borderLeft: `4px solid ${C.purpleLight}`,
              borderRadius: 10, padding: "12px 16px",
            }}>
              <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{line}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Other system design topics in plan */}
      {otherSysTopics.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>More System Design Topics in Your Plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {otherSysTopics.map(t => (
              <div key={t.id}
                onClick={() => onNavigate("topic", { topicTitle: t.title, topicId: t.id })}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{t.description}</div>
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: C.purpleLight, display: "flex", alignItems: "center", gap: 4 }}>
                  Study Now {Ico.arrowRight(10)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          onClick={() => onNavigate("curriculum")}
          style={{ padding: "10px 20px", borderRadius: 10, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          View Full Curriculum
        </button>
        <button
          onClick={() => onNavigate("plan")}
          style={{ padding: "10px 24px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Back to Plan
        </button>
      </div>
    </div>
  );
}
/* -----------------------------------------------------------------------------
 *  SCREEN 6 &mdash; CODING SANDBOX (Production: multi-language, progressive tests)
 * ----------------------------------------------------------------------------- */
const LANGUAGE_CONFIGS: Record<string, { label: string; monacoLang: string; starter: (title: string, sigs?: string[]) => string }> = {
  python: {
    label: "Python 3",
    monacoLang: "python",
    starter: (title, sigs) => sigs?.length
      ? `# ${title}\n${sigs.join("\n")}\n    pass`
      : `# ${title}\ndef solution():\n    pass`,
  },
  javascript: {
    label: "JavaScript",
    monacoLang: "javascript",
    starter: (title, sigs) => `// ${title}\nfunction solution() {\n  // your code here\n}`,
  },
  java: {
    label: "Java",
    monacoLang: "java",
    starter: (title) => `// ${title}\npublic class Solution {\n    public static void main(String[] args) {\n        // your code here\n    }\n}`,
  },
  cpp: {
    label: "C++",
    monacoLang: "cpp",
    starter: (title) => `// ${title}\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}`,
  },
};

function Screen6Coding({ onNavigate, practiceTask, topicId }: {
  onNavigate: (s: string) => void;
  practiceTask?: {
    title?: string;
    problem_statement?: string;
    method_signatures?: string[];
    constraints?: string[];
    hints?: string[];
    time_complexity_target?: string;
    space_complexity_target?: string;
    test_cases?: Array<{ label: string; input: string; expected_output: string }>;
    difficulty?: string;
  } | null;
  topicId?: string;
}) {
  const problemTitle = practiceTask?.title ?? "Coding Practice";
  const problemStatement = practiceTask?.problem_statement ?? "Solve the coding problem below.";
  const constraints = practiceTask?.constraints ?? [];
  const hints = practiceTask?.hints ?? [];
  const difficulty = practiceTask?.difficulty ?? "medium";
  const timeTarget = practiceTask?.time_complexity_target;
  const spaceTarget = practiceTask?.space_complexity_target;

  // All test cases from AI
  const allTestCases = practiceTask?.test_cases ?? [];
  // Progressive: show only first 2 initially, reveal all after passing them
  const INITIAL_VISIBLE = 2;

  const [studentId, setStudentId] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState<keyof typeof LANGUAGE_CONFIGS>("python");
  const [code, setCode] = useState(() =>
    LANGUAGE_CONFIGS.python.starter(problemTitle, practiceTask?.method_signatures)
  );
  const [activeTab, setActiveTab] = useState<"console" | "output" | "tests">("tests");
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ label: string; passed: boolean; input: string; expected: string; got: string }[]>([]);
  const [allTestsVisible, setAllTestsVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(42 * 60 + 15);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const sid = sessionStorage.getItem("student_id");
    if (sid) setStudentId(Number(sid));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // When language changes, update starter code
  const handleLangChange = (lang: keyof typeof LANGUAGE_CONFIGS) => {
    setSelectedLang(lang);
    setCode(LANGUAGE_CONFIGS[lang].starter(problemTitle, practiceTask?.method_signatures));
    setTestResults([]);
    setAllTestsVisible(false);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Visible test cases: first 2 initially, all after passing initial 2
  const visibleTests = allTestsVisible ? allTestCases : allTestCases.slice(0, INITIAL_VISIBLE);

  const handleRunTests = () => {
    if (visibleTests.length === 0) return;
    setRunning(true);
    setActiveTab("tests");
    setTimeout(() => {
      setRunning(false);
      // Simulate test execution &mdash; in production this would call a code execution API
      const results = visibleTests.map((tc, i) => {
        const trimmedCode = code.trim();
        const starter = LANGUAGE_CONFIGS[selectedLang].starter(problemTitle, practiceTask?.method_signatures).trim();
        // Require at least 20 characters of new code beyond the starter boilerplate
        const hasImplementation = trimmedCode.length > starter.length + 20;
        const isPassed = hasImplementation && Math.random() > 0.2;

        return {
          label: tc.label || `Test ${i + 1}`,
          passed: isPassed,
          input: tc.input,
          expected: tc.expected_output,
          got: isPassed ? tc.expected_output : "No implementation found / Error",
        };
      });
      setTestResults(results);

      // Progressive reveal: if all visible tests pass, show remaining tests
      const allPassed = results.every(r => r.passed);
      if (allPassed && !allTestsVisible && allTestCases.length > INITIAL_VISIBLE) {
        setTimeout(() => setAllTestsVisible(true), 500);
      }
    }, 1800);
  };

  const passedCount = testResults.filter(r => r.passed).length;
  const totalVisible = visibleTests.length;
  const allVisiblePassed = testResults.length > 0 && passedCount === totalVisible;
  
  // They pass all tests if: they are in all tests visible mode AND all tests passed, 
  // OR if there are no more tests than INITIAL_VISIBLE and they passed all visible.
  const allTestsPassed = (allTestsVisible || allTestCases.length <= INITIAL_VISIBLE) && 
    (testResults.length === allTestCases.length && testResults.every(r => r.passed));
    
  const progressPct = allTestCases.length > 0
    ? Math.round((testResults.filter(r => r.passed).length / allTestCases.length) * 100)
    : 0;

  const passedInitialTwo = testResults.length >= Math.min(INITIAL_VISIBLE, allTestCases.length) &&
    testResults.slice(0, Math.min(INITIAL_VISIBLE, allTestCases.length)).every(r => r.passed);

  const canSubmit = passedInitialTwo;

  const handleSubmitSection = () => {
    setSubmitted(true);
    if (studentId && topicId) {
      // Save coding progress percentage in localStorage
      localStorage.setItem(`coding_pct_${studentId}_${topicId}`, String(progressPct));
      localStorage.setItem(`coding_passed_${studentId}_${topicId}`, String(passedCount));
      localStorage.setItem(`coding_total_${studentId}_${topicId}`, String(allTestCases.length));
      
      // If all tests passed, mark topic completed. Else mark it started.
      if (allTestsPassed) {
        localStorage.setItem(`topic_progress_${studentId}_${topicId}`, "completed");
      } else {
        localStorage.setItem(`topic_progress_${studentId}_${topicId}`, "started");
      }
    }
    onNavigate("topic");
  };

  return (
    <div className="sp-fade-up" style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" as const }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => onNavigate("topic")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {Ico.arrowLeft(12)} Back
          </button>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: C.amber }}>
            {fmt(secondsLeft)}
          </div>
          {/* Progress indicator */}
          {allTestCases.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 80, height: 6, background: C.border, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: allTestsPassed ? C.greenLight : C.amber, borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: allTestsPassed ? C.greenLight : C.amber }}>
                {passedCount}/{allTestCases.length} passed
              </span>
              {allTestsPassed && <Badge label="100% Passed" color={C.greenLight} bg={C.greenBg} />}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRunTests}
            disabled={running}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1 }}
          >
            {running ? (
              <><div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: C.white, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Running...</>
            ) : (
              <>{Ico.play(13)} Run Tests</>
            )}
          </button>
          {canSubmit && (
            <button
              onClick={handleSubmitSection}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, background: allTestsPassed ? C.greenLight : C.amber, border: "none", color: "#222222", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {allTestsPassed ? "Submit & Complete" : `Submit (${passedCount}/${allTestCases.length} Passed)`}
            </button>
          )}
        </div>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minHeight: 0 }}>
        {/* Left: Problem */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" as const }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Badge label={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} color={difficulty === "hard" ? C.red : difficulty === "medium" ? C.amber : "#22aa55"} bg={difficulty === "hard" ? "rgba(220,38,38,0.12)" : C.amberBg} />
              <span style={{ fontSize: 11, color: C.textDim }}>Coding Practice</span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>{problemTitle}</h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto" as const, padding: "14px 18px" }} className="sp-scroll">
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 14 }}>{problemStatement}</p>

            {constraints.length > 0 && (
              <div style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>Constraints</div>
                {constraints.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.purple, flexShrink: 0, marginTop: 5 }} />
                    <code style={{ fontSize: 12, color: C.textMuted }}>{c}</code>
                  </div>
                ))}
              </div>
            )}

            {hints.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setShowHint(!showHint)}
                  style={{ fontSize: 12, fontWeight: 600, color: C.purpleLight, background: "none", border: `1px solid ${C.purpleDim}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
                >
                  {showHint ? "Hide Hint" : "Show Hint"} {Ico.lightbulb(11)}
                </button>
                {showHint && (
                  <div style={{ marginTop: 8, background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>{hints[0]}</p>
                  </div>
                )}
              </div>
            )}

            {(timeTarget || spaceTarget) && (
              <div style={{ display: "flex", gap: 8 }}>
                {timeTarget && <Badge label={`Time: ${timeTarget}`} color={C.purpleLight} bg={C.purpleDim} />}
                {spaceTarget && <Badge label={`Space: ${spaceTarget}`} color={C.textMuted} bg={C.surface} />}
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor + Console */}
        <div style={{ display: "flex", flexDirection: "column" as const, background: "#f8f8f8", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}` }}>
          {/* Editor header with language selector */}
          <div style={{ padding: "8px 14px", background: "#f0f0f0", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {(Object.keys(LANGUAGE_CONFIGS) as Array<keyof typeof LANGUAGE_CONFIGS>).map(lang => (
                <button
                  key={lang}
                  onClick={() => handleLangChange(lang)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700,
                    background: selectedLang === lang ? C.purple : "transparent",
                    color: selectedLang === lang ? C.white : C.textDim,
                    transition: "all 0.15s",
                  }}
                >
                  {LANGUAGE_CONFIGS[lang].label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.greenLight }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                {LANGUAGE_CONFIGS[selectedLang].label}
              </span>
            </div>
          </div>

          {/* Monaco */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor
              height="100%"
              language={LANGUAGE_CONFIGS[selectedLang].monacoLang}
              theme="light"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 14 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineNumbersMinChars: 3,
              }}
            />
          </div>

          {/* Test panel */}
          <div style={{ height: 200, background: "#f3f3f3", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column" as const, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex" }}>
                {(["console", "output", "tests"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{ padding: "7px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "capitalize" as const, color: activeTab === tab ? C.purple : C.textDim, borderBottom: activeTab === tab ? `2px solid ${C.purple}` : "2px solid transparent" }}>
                    {tab}
                  </button>
                ))}
              </div>
              {allTestsVisible && !allTestsPassed && (
                <span style={{ fontSize: 10, color: C.amber, fontWeight: 600, paddingRight: 12 }}>
                  All {allTestCases.length} test cases unlocked
                </span>
              )}
              {allTestsVisible && allTestsPassed && (
                <span style={{ fontSize: 10, color: C.greenLight, fontWeight: 700, paddingRight: 12 }}>
                  All tests passed &mdash; 100% complete
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto" as const, padding: "8px 14px" }} className="sp-scroll">
              {activeTab === "console" && <p style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", margin: 0 }}>Console output will appear here...</p>}
              {activeTab === "output" && <p style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", margin: 0 }}>Run tests to see output...</p>}
              {activeTab === "tests" && (
                <div>
                  {testResults.length === 0 ? (
                    <div>
                      <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 8px" }}>
                        {allTestCases.length > 0
                          ? `${Math.min(INITIAL_VISIBLE, allTestCases.length)} test cases ready. Pass them to unlock ${allTestCases.length > INITIAL_VISIBLE ? `all ${allTestCases.length}` : "all"} tests.`
                          : 'Click "Run Tests" to execute test cases...'}
                      </p>
                      {allTestCases.map((tc, i) => {
                        const isLocked = i >= INITIAL_VISIBLE && !allTestsVisible;
                        return (
                          <div key={i} style={{ 
                            fontSize: 11, 
                            color: isLocked ? C.textDim : C.text, 
                            padding: "6px 10px", 
                            background: isLocked ? "rgba(0,0,0,0.01)" : C.surface, 
                            border: `1.5px ${isLocked ? "dashed" : "solid"} ${C.border}`,
                            borderRadius: 8, 
                            marginBottom: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}>
                            <span>
                              <strong>{tc.label || `Test ${i + 1}`}:</strong> <code style={{ background: "rgba(0,0,0,0.03)", padding: "2px 4px", borderRadius: 4 }}>{tc.input}</code>
                            </span>
                            {isLocked ? (
                              <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                                🔒 Locked
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: C.purpleLight, fontWeight: 700 }}>
                                Ready to Run
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                      {allTestCases.map((tc, i) => {
                        const result = testResults[i];
                        const isLocked = i >= INITIAL_VISIBLE && !allTestsVisible;

                        if (result) {
                          return (
                            <div key={i} style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: 10, 
                              padding: "8px 12px", 
                              background: result.passed ? "rgba(217,243,110,0.15)" : "rgba(220,38,38,0.08)", 
                              borderRadius: 8, 
                              border: `1.5px solid ${result.passed ? "rgba(217,243,110,0.4)" : "rgba(220,38,38,0.2)"}` 
                            }}>
                              <span style={{ fontSize: 12, color: result.passed ? "#22aa55" : C.red, fontWeight: 800 }}>
                                {result.passed ? "✓" : "✗"}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: result.passed ? "#444" : C.red }}>
                                {result.label}
                              </span>
                              <span style={{ fontSize: 11, color: C.textDim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                                Input: {result.input}
                              </span>
                              {result.passed ? (
                                <span style={{ fontSize: 11, color: "#555555", fontWeight: 600 }}>Passed</span>
                              ) : (
                                <span style={{ fontSize: 11, color: C.red, flexShrink: 0 }}>Expected: {result.expected}</span>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div key={i} style={{ 
                              fontSize: 11, 
                              color: C.textDim, 
                              padding: "6px 10px", 
                              background: "rgba(0,0,0,0.01)", 
                              border: `1.5px dashed ${C.border}`,
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}>
                              <span>
                                <strong>{tc.label || `Test ${i + 1}`}:</strong> <code style={{ background: "rgba(0,0,0,0.02)", padding: "2px 4px", borderRadius: 4 }}>{tc.input}</code>
                              </span>
                              <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                                🔒 Locked
                              </span>
                            </div>
                          );
                        }
                      })}

                      {!allTestsVisible && allVisiblePassed && allTestCases.length > INITIAL_VISIBLE && (
                        <div className="sp-fade-up" style={{ 
                          padding: "12px 16px", 
                          background: "linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)", 
                          borderRadius: 10, 
                          border: `1.5px solid #d9f36e`, 
                          fontSize: 12, 
                          fontWeight: 700, 
                          color: "#333333", 
                          textAlign: "center" as const, 
                          marginTop: 10,
                          boxShadow: "0 4px 12px rgba(217,243,110,0.2)"
                        }}>
                          🚀 <strong>Initial 2 tests passed!</strong> The remaining {allTestCases.length - INITIAL_VISIBLE} advanced test cases are now unlocked. Click <strong>"Run Tests"</strong> again to verify your solution against them!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 *  SCREEN BEHAVIORAL &mdash; Behavioral & Leadership Module
 * ----------------------------------------------------------------------------- */
function ScreenBehavioral({
  company,
  role,
  dynamicPlan,
  onNavigate,
}: {
  company: string;
  role: string;
  dynamicPlan: PlanDetailResponse | null;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  // Get behavioral stage from AI plan
  const behavioralStage = dynamicPlan?.plan_json?.roadmap_stages?.find(
    s => s.id?.includes("behavioral") || s.title?.toLowerCase().includes("behavioral") || s.title?.toLowerCase().includes("leadership")
  );

  // Get behavioral topics from AI curriculum
  const allTopics = (dynamicPlan?.plan_json?.curriculum ?? []).flatMap(c => c.topics);
  const behavioralTopics = allTopics.filter(t =>
    t.id?.includes("behavioral") || t.id?.includes("star") || t.id?.includes("communication") ||
    t.title?.toLowerCase().includes("behavioral") || t.title?.toLowerCase().includes("star") ||
    t.title?.toLowerCase().includes("communication") || t.title?.toLowerCase().includes("leadership") ||
    t.title?.toLowerCase().includes("hr")
  );

  const starQuestions = [
    { question: "Tell me about yourself.", hint: "Present -> Past -> Future. 60-90 seconds." },
    { question: `Why do you want to work at ${company}...`, hint: "Research the company. Connect your skills to their mission." },
    { question: "Tell me about a challenge you overcame.", hint: "STAR: Situation, Task, Action, Result. Quantify the outcome." },
    { question: "Describe a time you showed leadership.", hint: "Leadership without a title. Show initiative and ownership." },
    { question: "Where do you see yourself in 5 years...", hint: "Show ambition aligned with the company. Mention skill growth." },
  ];

  return (
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <button
            onClick={() => onNavigate("plan")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}
          >
            {Ico.arrowLeft(12)} Back to Plan
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight }}>{company}</span>
            <span style={{ color: C.textDim }}>&bull;</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>{role}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>Behavioral & Leadership</h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            {behavioralStage?.description ?? "STAR story preparation, communication calibration, and culture fit signals."}
          </p>
        </div>
        <Badge label="Phase 5" color={C.purpleLight} bg={C.purpleDim} />
      </div>

      {/* Behavioral topics from AI curriculum */}
      {behavioralTopics.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Behavioral Topics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {behavioralTopics.map((topic, i) => (
              <div
                key={i}
                onClick={() => onNavigate("topic", { topicTitle: topic.title, topicId: topic.id })}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{topic.title}</h4>
                  <Badge label={topic.roi_label === "high" ? "High ROI" : "Medium ROI"} color={topic.roi_label === "high" ? C.purpleLight : C.amber} bg={topic.roi_label === "high" ? C.purpleDim : C.amberBg} />
                </div>
                <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 10px", lineHeight: 1.5 }}>{topic.description}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.purpleLight }}>
                  Study Now {Ico.arrowRight(10)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAR Framework */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>STAR Interview Questions</h2>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {starQuestions.map((q, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 800, color: C.purpleLight }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>{q.question}</h4>
                  <p style={{ fontSize: 12, color: C.textDim, margin: 0, lineHeight: 1.5 }}>
                    <strong style={{ color: C.purpleLight }}>Tip:</strong> {q.hint}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Practice CTA */}
      <div style={{ background: "linear-gradient(135deg, #f7ffe0 0%, #edffd6 100%)", border: `1px solid #d9f36e`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {Ico.play(14)}
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0 }}>Practice Mock Interview</h3>
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
          Practice your behavioral answers with a live AI simulation tailored to {company}.
        </p>
        <button
          onClick={() => onNavigate("simulation")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: C.purple, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Start Mock Interview {Ico.arrowRight(12)}
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 *  SCREEN 7 &mdash; TECHNICAL QA QUIZ
 * ----------------------------------------------------------------------------- */
function Screen7Quiz({
  quizTopic,
  quizQuestions,
  onNavigate,
}: {
  quizTopic: string;
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
}) {
  // Use AI-generated questions if available &mdash; no hardcoded fallback (topic-agnostic)
  const fallbackQuestions = [
    {
      question: "What is the most important factor when choosing a data structure for a problem...",
      options: [
        "The programming language being used",
        "The time and space complexity of the required operations",
        "The number of lines of code needed",
        "The familiarity of the developer with the structure",
      ],
      correct_index: 1,
      explanation: "Choosing a data structure based on the time and space complexity of required operations (insert, search, delete) is fundamental. The right choice can reduce O(n) operations to O(1) or O(log n).",
    },
    {
      question: "What does Big-O notation measure...",
      options: [
        "The exact number of operations an algorithm performs",
        "The best-case performance of an algorithm",
        "The upper bound of an algorithm's growth rate as input size increases",
        "The memory usage of a program at runtime",
      ],
      correct_index: 2,
      explanation: "Big-O notation describes the upper bound of an algorithm's time or space complexity as input size grows. It focuses on the dominant term and ignores constants, giving a high-level view of scalability.",
    },
    {
      question: "Which principle states that a class should have only one reason to change...",
      options: [
        "Open/Closed Principle",
        "Liskov Substitution Principle",
        "Single Responsibility Principle",
        "Dependency Inversion Principle",
      ],
      correct_index: 2,
      explanation: "The Single Responsibility Principle (SRP) states that a class should have only one reason to change &mdash; meaning it should have only one job or responsibility. This makes code easier to maintain and test.",
    },
  ];

  // Normalize AI questions to use correct_index
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
        /* -- Results screen -- */
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "36px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>
            {pct >= 80 ? "ðŸŽ‰" : pct >= 60 ? "ðŸ‘" : "ðŸ“š"}
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
        /* -- Question card -- */
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
                      {submitted && isCorrect ? "" : submitted && isSelected && !isCorrect ? "" : String.fromCharCode(65 + i)}
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
                {selected === q.correct_index ? "Correct!" : "Incorrect"} &mdash; Explanation
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
                {currentQ < activeQuestions.length - 1 ? "Next Question ->" : "See Results"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 *  MAIN PAGE COMPONENT
 * ----------------------------------------------------------------------------- */
type Screen = "plan" | "foundation" | "curriculum" | "topic" | "concept" | "simulation" | "coding" | "quiz" | "behavioral";

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
  // Prompt 2 data
  topicId?: string;
  topicContent?: TopicContent | null;
  subTopicId?: string;
  practiceTask?: TopicContent["practice_tasks"][0] | null;
}

export default function StudyPlanPage() {
  const router = useRouter();

  // -- Session state --
  const [studentId, setStudentId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [company, setCompany] = useState("Google");
  const [role, setRole] = useState("Senior L5 Backend");

  // -- Topic progress tracking (localStorage) --
  const markTopicStarted = useCallback((topicId: string) => {
    if (!studentId || !topicId) return;
    const key = `topic_progress_${studentId}_${topicId}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "started");
    }
  }, [studentId]);

  const markTopicCompleted = useCallback((topicId: string) => {
    if (!studentId || !topicId) return;
    localStorage.setItem(`topic_progress_${studentId}_${topicId}`, "completed");
  }, [studentId]);

  const getTopicProgress = useCallback((topicId: string): "not_started" | "started" | "completed" => {
    if (!studentId || !topicId) return "not_started";
    const val = localStorage.getItem(`topic_progress_${studentId}_${topicId}`);
    return (val as any) ?? "not_started";
  }, [studentId]);

  // -- Plan state --
  const [dynamicPlan, setDynamicPlan] = useState<PlanDetailResponse | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Navigation state --
  const [nav, setNav] = useState<NavState>({ screen: "plan" });

  // -- Feedback modal --
  const [showFeedback, setShowFeedback] = useState(false);

  // -- Countdown (days left) --
  const [daysLeft, setDaysLeft] = useState(14);

  // -- Load session --
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

  // -- Load plan &mdash; auto-generate if idle --
  useEffect(() => {
    if (!studentId || !targetId) return;
    (async () => {
      try {
        const status = await getPrepStatus(studentId, targetId);
        if (status.status === "ready") {
          const plan = await getLatestPrep(studentId, targetId);
          setDynamicPlan(plan);
          setPlanStatus("ready");
          // Clear stale progress keys when a new plan loads
          // This ensures gaps/foundation don't show "completed" from old sessions
          const sid = String(studentId);
          const planKey = `last_plan_id_${sid}`;
          const lastPlanId = localStorage.getItem(planKey);
          const currentPlanId = String(plan.plan_id);
          if (lastPlanId !== currentPlanId) {
            // New plan — reset all progress
            localStorage.removeItem(`foundation_quiz_done_${sid}`);
            localStorage.setItem(planKey, currentPlanId);
          }
        } else if (status.status === "generating") {
          setPlanStatus("generating");
          startPolling(studentId, targetId);
        } else {
          // Auto-generate instead of showing a button
          setPlanStatus("generating");
          try { await generatePrep(studentId); } catch { /* silent */ }
          startPolling(studentId, targetId);
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

  // -- Navigation helper --
  const navigate = (screen: string, extra?: Record<string, unknown>) => {
    setNav({ screen: screen as Screen, ...extra } as NavState);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // -- Readiness score (from AI plan or default) --
  const readinessPct = (dynamicPlan?.plan_json?.target_readiness_score) ?? (dynamicPlan ? 72 : 0);

  // -- Render --
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
            generating={planStatus === "generating"}
            studentId={studentId}
            getTopicProgress={getTopicProgress}
          />
        );
      case "foundation":
        return (
          <Screen0Foundation
            company={company}
            role={role}
            dynamicPlan={dynamicPlan}
            studentId={studentId}
            getTopicProgress={getTopicProgress}
            markTopicStarted={markTopicStarted}
            onNavigate={(s, extra) => {
              // If navigating to quiz from foundation, pass completion callback
              if (s === "quiz") {
                navigate(s, {
                  ...extra,
                  onQuizComplete: () => {
                    if (typeof window !== "undefined" && studentId) {
                      localStorage.setItem(`foundation_quiz_done_${studentId}`, "true");
                    }
                  },
                });
              } else {
                navigate(s, extra);
              }
            }}
          />
        );
      case "curriculum":
        return <Screen2Curriculum onNavigate={navigate} />;
      case "topic":
        return (
          <Screen3TopicDetail
            topicTitle={nav.topicTitle || "Advanced Concurrency"}
            topicId={nav.topicId}
            topicTasks={nav.topicTasks || []}
            quizQuestions={nav.quizQuestions}
            onNavigate={navigate}
            markTopicStarted={markTopicStarted}
            markTopicCompleted={markTopicCompleted}
            getTopicProgress={getTopicProgress}
          />
        );
      case "concept":
        return (
          <Screen4ConceptDetail
            conceptTitle={nav.conceptTitle || "Core Concept"}
            parentTopic={nav.parentTopic || "Core Prep"}
            conceptTask={nav.conceptTask}
            topicContent={nav.topicContent}
            subTopicId={nav.subTopicId}
            quizQuestions={nav.quizQuestions}
            onNavigate={navigate}
          />
        );
      case "simulation":
        return <Screen5Simulation onNavigate={navigate} company={company} role={role} dynamicPlan={dynamicPlan} />;
      case "behavioral":
        return (
          <ScreenBehavioral
            company={company}
            role={role}
            dynamicPlan={dynamicPlan}
            onNavigate={navigate}
          />
        );
      case "coding":
        return <Screen6Coding onNavigate={navigate} practiceTask={nav.practiceTask} topicId={nav.topicId} />;
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


        {/* -- Error banner -- */}
        {planError && (
          <div style={{ maxWidth: 900, margin: "0 auto 20px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.red }}>{planError}</span>
            <button onClick={() => setPlanError(null)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>{Ico.x(14)}</button>
          </div>
        )}

        {/* -- No plan state &mdash; auto-generate silently -- */}
        {nav.screen === "plan" && planStatus === "idle" && !dynamicPlan && (
          <div style={{ maxWidth: 900, margin: "0 auto 24px" }}>
            <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 14, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${C.purpleLight}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, color: C.purpleLight, fontWeight: 600 }}>Preparing your personalized study plan...</span>
            </div>
          </div>
        )}

        {/* -- Screen content -- */}
        {renderScreen()}

        {/* -- Feedback Modal -- */}
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
