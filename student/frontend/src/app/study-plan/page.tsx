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
  getStudyProgress,
  syncTopicProgress,
  evaluateSTARResponse,
  executeCode,
  type STAREvaluateResponse,
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

const defaultFoundationTopics = [
  { id: "java-fundamentals", title: "Java Fundamentals & Syntax", description: "Master variables, loops, control flow, and baseline language constructs.", proficiency_tag: "intermediate", roi_label: "high", difficulty: "easy" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "oop", title: "Object-Oriented Programming (OOP)", description: "Inheritance, polymorphism, encapsulation, and abstraction in design.", proficiency_tag: "intermediate", roi_label: "high", difficulty: "easy" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "basic-ds", title: "Basic Data Structures (Arrays, Lists)", description: "Understanding arrays, array lists, dynamic resizing, and sequential access.", proficiency_tag: "intermediate", roi_label: "high", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "complexity", title: "Time & Space Complexity Basics", description: "Analysing algorithms, Big-O notation, and scalability thresholds.", proficiency_tag: "intermediate", roi_label: "high", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "stacks-queues-basic", title: "Stacks & Queues Concept", description: "LIFO/FIFO mechanisms, standard interface operations, and call stacks.", proficiency_tag: "intermediate", roi_label: "medium", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "hashing-basics", title: "Hashing & HashTables Fundamentals", description: "Key-value pair mappings, bucket arrays, and simple hash collision policies.", proficiency_tag: "intermediate", roi_label: "medium", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "sorting-basic", title: "Sorting & Searching baseline", description: "Binary search mechanics, bubble/selection/insertion sort differences.", proficiency_tag: "intermediate", roi_label: "medium", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "recursion-basic", title: "Recursion & Base Cases", description: "Call stack utilization, recursive relation designs, and simple backtracking.", proficiency_tag: "intermediate", roi_label: "medium", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "exception-handling", title: "Exceptions & Memory Management", description: "Try-catch-finally control paths, checked/unchecked exception hierarchies.", proficiency_tag: "intermediate", roi_label: "medium", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
  { id: "db-basics", title: "Basic SQL & Relational Models", description: "SELECT queries, WHERE filters, basic JOIN statements, and tables.", proficiency_tag: "intermediate", roi_label: "medium", difficulty: "medium" as const, stage_id: "foundation", sub_topics: [] as any[] },
];

const defaultBehavioralTopics = [
  { id: "conflict-resolution", title: "Conflict Resolution", description: "Handling disagreements within technical teams or managing manager misalignment productively.", roi_label: "high", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "team-leadership", title: "Team Leadership", description: "Fostering collaboration, leading sprint designs, mentoring junior engineers, and taking ownership.", roi_label: "high", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "culture-fit", title: "Culture Fit & Company Values", description: "Demonstrating growth mindset, customer obsession, and core leadership principles in scenario tests.", roi_label: "high", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "ethical-decision", title: "Ethical Decision Making", description: "Maintaining integrity in product designs, handling compliance concerns, and making principal calls.", roi_label: "high", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "pressure-outages", title: "Problem Solving under Pressure", description: "Dealing with production outages, high stakes service failures, and hard project deadlines.", roi_label: "medium", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "peer-feedback", title: "Delivering Peer Feedback", description: "Providing actionable constructive reviews, managing up, and receiving critical growth reviews.", roi_label: "medium", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "adaptability", title: "Adaptability & Ambiguity", description: "Pivoting in response to rapid strategy shifts or undefined scope conditions with poise.", roi_label: "medium", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "stakeholder-comm", title: "Stakeholder Management", description: "Communicating deeply complex technical concepts cleanly to non-technical partners.", roi_label: "medium", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "goal-setting", title: "Goal Setting & Initiative", description: "Establishing milestones, maintaining project accountability, and exhibiting extreme project ownership.", roi_label: "medium", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
  { id: "learning-failure", title: "Handling Failure & Mistake post-mortems", description: "Conducting post-mortems, extracting systemic improvements, and accepting accountability.", roi_label: "medium", difficulty: "medium" as const, stage_id: "behavioral", sub_topics: [] as any[] },
];

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
  targetId,
  onNavigate,
  getTopicProgress,
  markTopicStarted,
  getTopicLiveProgress,
}: {
  company: string;
  role: string;
  dynamicPlan: PlanDetailResponse | null;
  studentId?: number | null;
  targetId?: number | null;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
  markTopicStarted: (topicId: string) => void;
  getTopicLiveProgress: (topicId: string) => { pct: number; status: "queued" | "in-progress" | "completed" };
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
  const isBehavioral = (t: any) => {
    const id = (t.id ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    const cat = (t.category_id ?? "").toLowerCase();
    return id.includes("behavioral") || id.includes("star") || id.includes("communication") ||
      title.includes("behavioral") || title.includes("star") ||
      title.includes("communication") || title.includes("leadership") ||
      title.includes("hr") || title.includes("conflict") ||
      title.includes("team") || title.includes("culture") ||
      title.includes("tell me about yourself") || title.includes("research") ||
      cat.includes("behavioral") || cat.includes("leadership");
  };

  const allTopics = (dynamicPlan?.plan_json?.curriculum ?? []).flatMap(c => c.topics).filter(t => {
    const id = (t.id ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    if (id.includes("system") || id.includes("design") || title.includes("system design") || title.includes("architecture")) return false;
    if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return false;
    return true;
  });

  // Primary: topics the AI explicitly placed in the foundation stage, excluding behavioral topics
  let profileSkillTopics = allTopics.filter(t => t.stage_id === "foundation" && !isBehavioral(t));

  // Fallback 1: topics tagged advanced or intermediate (student already knows them)
  if (profileSkillTopics.length === 0) {
    profileSkillTopics = allTopics.filter(
      t => (t.proficiency_tag === "advanced" || t.proficiency_tag === "intermediate") && !isBehavioral(t)
    );
  }

  // Fallback 2: fuzzy match against sessionStorage known_skills
  if (profileSkillTopics.length === 0 && knownSkills.length > 0) {
    profileSkillTopics = allTopics.filter(t =>
      !isBehavioral(t) && knownSkills.some(ks =>
        t.title.toLowerCase().includes(ks.skill.toLowerCase()) ||
        ks.skill.toLowerCase().includes(t.title.toLowerCase())
      )
    );
  }

  // Fallback 3: inject primary skill match if not already present
  if (primarySkill && !profileSkillTopics.some(t => t.title.toLowerCase().includes(primarySkill.toLowerCase()))) {
    const matched = allTopics.find(t => !isBehavioral(t) && t.title.toLowerCase().includes(primarySkill.toLowerCase()));
    if (matched) profileSkillTopics.unshift(matched);
  }

  const foundationTopics = profileSkillTopics;
  const weakAreas = dynamicPlan?.plan_json?.weak_areas ?? [];

  // profToMastery kept for progress bar color selection only (not for displaying numbers)
  const profToMastery = (tag: string) => tag === "advanced" ? 80 : tag === "intermediate" ? 50 : 15;

  // avgMastery: count how many foundation topics the student actually COMPLETED (each = 100%)
  // NEVER use proficiency_tag as a mastery number — that is the student's baseline, not their progress
  // avgMastery: count how many foundation topics the student actually COMPLETED (each = 100%)
  // NEVER use proficiency_tag as a mastery number — that is the student's baseline, not their progress
  const totalPct = foundationTopics.reduce((acc, t) => acc + getTopicLiveProgress(t.id).pct, 0);
  const avgMastery = foundationTopics.length > 0
    ? Math.round(totalPct / foundationTopics.length)
    : 0;

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

      {/* Summary banner — only show Phase 1 Complete after quiz is actually done */}
      {(() => {
        const quizDone = typeof window !== "undefined" && studentId && targetId
          ? localStorage.getItem(`foundation_quiz_done_${studentId}_${targetId}`) === "true"
          : false;
        return quizDone ? (
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
        ) : (
          <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleDim}`, borderRadius: 14, padding: "16px 22px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>📚</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>Foundation Phase — In Progress</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Review your existing skills below and complete the Foundation Quiz to finish Phase 1.</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Badge label="Not Complete" color={C.amber} bg={C.amberBg} />
            </div>
          </div>
        );
      })()}

      {/* AI-derived topic grid &mdash; topics student already has some proficiency in */}
      {foundationTopics.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>Your Existing Skills</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 32 }}>
            {foundationTopics.map((topic, i) => {
              const live = getTopicLiveProgress(topic.id);
              // Real mastery: ONLY from actual topic completion — never from proficiency_tag
              // proficiency_tag tells us the student's STARTING level, not their completion
              const displayMastery = live.pct;
              const isCompleted = live.status === "completed";
              const isStarted = live.status === "in-progress";
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
  targetId,
  getTopicProgress,
  getTopicLiveProgress,
  markTopicStarted,
}: {
  dynamicPlan: PlanDetailResponse | null;
  company: string;
  role: string;
  daysLeft: number;
  readinessPct: number;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  generating: boolean;
  studentId: number | null;
  targetId: number | null;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
  getTopicLiveProgress: (topicId: string) => { pct: number; status: "queued" | "in-progress" | "completed" };
  markTopicStarted: (topicId: string) => void;
}) {
  // Support both new curriculum format and legacy daily_plan format
  const isNewFormat = !!(dynamicPlan?.plan_json?.curriculum);
  const dailyPlan: DailyPlanItem[] = dynamicPlan?.plan_json?.daily_plan ?? [];
  const curriculum = dynamicPlan?.plan_json?.curriculum ?? [];
  const highRoiIds = dynamicPlan?.plan_json?.high_roi_topic_ids ?? [];
  const readinessFromPlan = dynamicPlan?.plan_json?.target_readiness_score;

  // Get student's actual skills from sessionStorage (set during onboarding)
  const primarySkill = typeof window !== "undefined" ? sessionStorage.getItem("primary_skill") ?? "" : "";
  const knownSkillsRaw = typeof window !== "undefined" ? sessionStorage.getItem("known_skills") ?? "[]" : "[]";
  let knownSkills: Array<{skill: string; proficiency: string}> = [];
  try { knownSkills = JSON.parse(knownSkillsRaw); } catch { knownSkills = []; }

  const isBehavioral = (t: any) => {
    const id = (t.id ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    const cat = (t.category_id ?? "").toLowerCase();
    return id.includes("behavioral") || id.includes("star") || id.includes("communication") ||
      title.includes("behavioral") || title.includes("star") ||
      title.includes("communication") || title.includes("leadership") ||
      title.includes("hr") || title.includes("conflict") ||
      title.includes("team") || title.includes("culture") ||
      title.includes("tell me about yourself") || title.includes("research") ||
      cat.includes("behavioral") || cat.includes("leadership");
  };

  const allTopics = curriculum.flatMap(c => c.topics.map(t => ({ ...t, category_id: c.category_id, category_title: c.category_title }))).filter(t => {
    const id = (t.id ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    if (id.includes("system") || id.includes("design") || title.includes("system design") || title.includes("architecture")) return false;
    if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return false;
    return true;
  });
  let profileSkillTopics = allTopics.filter(t => (t.stage_id || "").toLowerCase() === "foundation");
  if (profileSkillTopics.length === 0) {
    profileSkillTopics = allTopics.filter(
      t => (t.proficiency_tag || "").toLowerCase() === "advanced" || (t.proficiency_tag || "").toLowerCase() === "intermediate"
    );
  }
  if (profileSkillTopics.length === 0 && knownSkills.length > 0) {
    profileSkillTopics = allTopics.filter(t =>
      knownSkills.some(ks =>
        t.title.toLowerCase().includes(ks.skill.toLowerCase()) ||
        ks.skill.toLowerCase().includes(t.title.toLowerCase())
      )
    );
  }
  if (primarySkill && !profileSkillTopics.some(t => t.title.toLowerCase().includes(primarySkill.toLowerCase()))) {
    const matched = allTopics.find(t => t.title.toLowerCase().includes(primarySkill.toLowerCase()));
    if (matched) profileSkillTopics.unshift(matched);
  }
  
  // Final Fallback: if still empty, pick easy topics, or just the first available topics
  // so the module is never empty.
  if (profileSkillTopics.length === 0 && allTopics.length > 0) {
    let fallback = allTopics.filter(t => t.difficulty === "easy" && !isBehavioral(t));
    if (fallback.length === 0) {
      fallback = allTopics.filter(t => !isBehavioral(t));
    }
    profileSkillTopics = fallback;
  }
  
  const foundationTopics = profileSkillTopics;

  const foundationCards = foundationTopics.slice(0, 4).map((topic) => {
    const live = getTopicLiveProgress(topic.id);
    return {
      title: topic.title,
      status: live.status,
      progress: live.pct,
      topicId: topic.id,
    };
  });

  const defaultFoundationCards = [
    { title: "Java Fundamentals & Syntax", status: "queued" as const, progress: 0, topicId: "java-fundamentals" },
    { title: "Object-Oriented Programming (OOP)", status: "queued" as const, progress: 0, topicId: "oop" },
    { title: "Basic Data Structures (Arrays, Lists)", status: "queued" as const, progress: 0, topicId: "basic-ds" },
    { title: "Time & Space Complexity Basics", status: "queued" as const, progress: 0, topicId: "complexity" },
  ];

  const finalFoundationCards = foundationCards;

  // AI-generated roadmap stages (from Prompt 1 output)
  // Filter out any legacy gap/gaps-identification stages, System Design, and Mock Interview Simulation — removed from product
  const rawStages = (dynamicPlan?.plan_json?.roadmap_stages ?? []).filter(
    s => {
      const id = (s.id ?? "").toLowerCase();
      const title = (s.title ?? "").toLowerCase();
      if (id.includes("gap") || title.includes("gap")) return false;
      if (id.includes("system") || id.includes("design") || title.includes("system design")) return false;
      if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return false;
      return true;
    }
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
      const quizDone = typeof window !== "undefined" && targetId && localStorage.getItem(`foundation_quiz_done_${sid}_${targetId}`) === "true";
      derivedStatus = quizDone ? "completed" : "active";
    } else if (id.includes("core-prep") || id.includes("core_prep") || id.includes("high-roi") || id.includes("high_roi") || id.includes("roi")) {
      // Core Prep: completed when all high_roi topics are completed
      const allTopicsWithCat = curriculum.flatMap(c => c.topics.map(t => ({ ...t, category_id: c.category_id })));
      const corePrepTopics = highRoiIds.length > 0
        ? highRoiIds.map(tid => allTopicsWithCat.find(t => t.id === tid)).filter(Boolean) as typeof allTopicsWithCat
        : allTopicsWithCat.filter(t => t.roi_label === "high").slice(0, 4);
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
  // PROGRESS RULES:
  //   status="queued"      → student has never opened this topic (no localStorage key)
  //   status="in-progress" → student opened it AND has actual task completion % stored
  //   status="completed"   → student explicitly completed all tasks
  //   progress %           → ONLY from coding_pct stored on actual submission, never from proficiency_tag
  const allCurriculumTopics = curriculum.flatMap(cat => cat.topics.map(t => ({ ...t, category_id: cat.category_id }))).filter(t => {
    const id = (t.id ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    if (id.includes("system") || id.includes("design") || title.includes("system design") || title.includes("architecture")) return false;
    if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return false;
    return true;
  });

  const topicCards = isNewFormat
    ? (() => {
        const highRoiTopics = highRoiIds.length > 0
          ? highRoiIds.map(id => allCurriculumTopics.find(t => t.id === id)).filter(Boolean) as typeof allCurriculumTopics
          : allCurriculumTopics.filter(t => t.roi_label === "high").slice(0, 4);
        return highRoiTopics.slice(0, 4).map((topic) => {
          const live = getTopicLiveProgress(topic.id);
          return {
            title: topic.title,
            status: live.status,
            progress: live.pct,
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
    : dailyPlan.slice(0, 4).map((day) => {
        // Legacy format: derive real progress from localStorage too
        const legacyId = day.focus.toLowerCase().replace(/\s+/g, "-");
        const trackProg = getTopicProgress(legacyId);
        const codingRaw = (typeof window !== "undefined" && studentId && targetId)
          ? localStorage.getItem(`coding_pct_${studentId}_${targetId}_${legacyId}`) : null;
        const live = getTopicLiveProgress(legacyId);
        const actualPct = live.pct;
        const cardSt: "completed" | "in-progress" | "queued" = live.status;
        return {
          title: day.focus,
          status: cardSt,
          progress: actualPct,
          day: day.day,
          tasks: day.tasks,
          allQuizQuestions: day.tasks.flatMap(t => t.quiz ?? []),
          topicId: legacyId,
          description: "",
          difficulty: "medium" as const,
          subTopics: [] as Array<{id: string; title: string}>,
        };
      });

  // Build behavioral topic cards from AI curriculum
  const behavioralCards = allCurriculumTopics
    .filter(isBehavioral)
    .slice(0, 4)
    .map(topic => ({
      title: topic.title,
      status: "queued" as const,
      topicId: topic.id,
    }));

  const finalBehavioralCards = behavioralCards.map(tc => {
    const live = getTopicLiveProgress(tc.topicId);
    return {
      title: tc.title,
      status: live.status,
      progress: live.pct,
      topicId: tc.topicId,
    };
  });

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

        {/* Render AI roadmap stages if available, else show default 3-stage structure */}
        {normalizedStages.length > 0 ? normalizedStages.map((stage, i) => {
          const isFoundation = stage.id === "foundation" || stage.title.toLowerCase().includes("foundation");
          const isCorePrepStage = stage.id === "core-prep" || stage.title.toLowerCase().includes("core prep") || stage.title.toLowerCase().includes("core-prep") || stage.id === "high-roi" || stage.id === "high-roi-topics";
          const isBehavioral = stage.id === "behavioral" || stage.id === "behavioral-leadership" || stage.title.toLowerCase().includes("behavioral") || stage.title.toLowerCase().includes("leadership");

          // Every section gets an "Explore More" button; Foundation, Core Prep, and Behavioral also get topic cards
          const stageExtra = (
            <div style={{ marginTop: 14 }}>
              {isFoundation && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {finalFoundationCards.map((tc, j) => (
                    <TopicCard
                      key={j}
                      title={tc.title}
                      status={tc.status}
                      progress={tc.progress}
                      onClick={() => {
                        markTopicStarted(tc.topicId);
                        onNavigate("topic", {
                          topicTitle: tc.title,
                          topicId: tc.topicId,
                        });
                      }}
                    />
                  ))}
                </div>
              )}
              {isCorePrepStage && (
                topicCards.length === 0 ? (
                  <div style={{ color: C.textDim, fontSize: 13, marginBottom: 12 }}>
                    {generating ? "Generating topics..." : "No topics yet."}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    {topicCards.map((tc, j) => (
                      <TopicCard
                        key={j}
                        title={tc.title}
                        status={tc.status as "in-progress" | "queued" | "completed"}
                        progress={tc.progress}
                        onClick={() => {
                          markTopicStarted(tc.topicId);
                          onNavigate("topic", {
                            topicTitle: tc.title,
                            topicId: tc.topicId,
                            topicDay: tc.day,
                            topicTasks: tc.tasks,
                            quizQuestions: tc.allQuizQuestions,
                          });
                        }}
                      />
                    ))}
                  </div>
                )
              )}
              {isBehavioral && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {finalBehavioralCards.map((tc, j) => (
                    <TopicCard
                      key={j}
                      title={tc.title}
                      status={tc.status}
                      progress={tc.progress}
                      onClick={() => {
                        markTopicStarted(tc.topicId);
                        onNavigate("topic", {
                          topicTitle: tc.title,
                          topicId: tc.topicId,
                        });
                      }}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => isFoundation ? onNavigate("foundation") : isBehavioral ? onNavigate("behavioral") : onNavigate("curriculum")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Explore More {Ico.arrowRight(12)}
              </button>
            </div>
          );

          return (
            <PhaseRow
              key={stage.id}
              index={i + 1}
              title={stage.title}
              status={stage.status as "completed" | "active" | "locked"}
              description={stage.description}
              extra={stageExtra}
            />
          );
        }) : (
          <>
            {/* Default 3-stage structure when no AI plan yet — no System Design, no Mock Interview */}
            <PhaseRow index={1} title="Foundation" status="active"
              description="Baseline assessment of your existing skills against the target JD."
              extra={
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    {finalFoundationCards.map((tc, i) => (
                      <TopicCard key={i} title={tc.title}
                        status={tc.status}
                        progress={tc.progress}
                        onClick={() => {
                          markTopicStarted(tc.topicId);
                          onNavigate("topic", { topicTitle: tc.title, topicId: tc.topicId });
                        }}
                      />
                    ))}
                  </div>
                  <button onClick={() => onNavigate("foundation")}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Explore More {Ico.arrowRight(12)}
                  </button>
                </div>
              }
            />
            <PhaseRow index={2} title="Core Prep" status="active" description=""
              extra={
                <div style={{ marginTop: 14 }}>
                  {topicCards.length === 0 ? (
                    <div style={{ color: C.textDim, fontSize: 13, marginBottom: 12 }}>
                      {generating ? "Generating topics..." : "No topics yet. Generate a plan to get started."}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                      {topicCards.map((tc, i) => (
                        <TopicCard key={i} title={tc.title}
                          status={tc.status as "in-progress" | "queued" | "completed"}
                          progress={tc.progress}
                          onClick={() => {
                            markTopicStarted(tc.topicId);
                            onNavigate("topic", { topicTitle: tc.title, topicId: tc.topicId, topicDay: tc.day, topicTasks: tc.tasks, quizQuestions: tc.allQuizQuestions });
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <button onClick={() => onNavigate("curriculum")}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Explore More {Ico.arrowRight(12)}
                  </button>
                </div>
              }
            />
            <PhaseRow index={3} title="Behavioral & Leadership" status="active"
              description="Final phase — communication, leadership philosophy, and culture fit simulations."
              extra={
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    {finalBehavioralCards.map((tc, i) => (
                      <TopicCard key={i} title={tc.title}
                        status={tc.status}
                        progress={tc.progress}
                        onClick={() => {
                          markTopicStarted(tc.topicId);
                          onNavigate("topic", { topicTitle: tc.title, topicId: tc.topicId });
                        }}
                      />
                    ))}
                  </div>
                  <button onClick={() => onNavigate("behavioral")}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Explore More {Ico.arrowRight(12)}
                  </button>
                </div>
              }
            />
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
function Screen2Curriculum({
  dynamicPlan,
  getTopicProgress,
  studentId,
  onNavigate,
  getTopicLiveProgress,
  markTopicStarted,
}: {
  dynamicPlan: PlanDetailResponse | null;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
  studentId: number | null;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  getTopicLiveProgress: (topicId: string) => { pct: number; status: "queued" | "in-progress" | "completed" };
  markTopicStarted: (topicId: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "not-started" | "in-progress" | "mastered">("all");

  const filterTabs = [
    { key: "all", label: "All Topics" },
    { key: "not-started", label: "Not Started" },
    { key: "in-progress", label: "In Progress" },
    { key: "mastered", label: "Mastered" },
  ] as const;

  // Build categories from AI dynamic plan or default fallback
  const rawCategories = (dynamicPlan?.plan_json?.curriculum ?? [
    {
      category: "Core Prep Data Structures & Algorithms",
      topics: [
        { id: "arrays-strings", title: "Array & String manipulation & Java fundamentals & OOP", description: "Master two-pointer technique, sliding window, and OOP principles in Java.", difficulty: "medium" },
        { id: "linked-lists", title: "Linked Lists & Spring Boot basics", description: "Singly and doubly linked lists, fast & slow pointers, and basic Spring components.", difficulty: "medium" },
        { id: "trees-graphs", title: "Trees & Graphs & Spring MVC", description: "BFS, DFS, binary search trees, MVC handlers, and routing.", difficulty: "hard" },
        { id: "dynamic-programming", title: "Dynamic Programming & Spring Data JPA", description: "Memoization, tabulation, entity mapping, and repository patterns.", difficulty: "hard" },
        { id: "stacks-queues", title: "Stacks & Queues & JUnit Testing", description: "LIFO/FIFO operations, queue implementation, and mock testing.", difficulty: "medium" },
        { id: "sorting-searching", title: "Advanced Sorting & Searching", description: "Quick sort, merge sort, binary search patterns, and custom comparators.", difficulty: "medium" },
      ]
    },
    {
      category: "Advanced Backend Preparation",
      topics: [
        { id: "concurrency", title: "Java Concurrency & Multithreading", description: "Threads, synchronization, executors, and thread safety patterns.", difficulty: "hard" },
        { id: "garbage-collection", title: "JVM Memory & Garbage Collection", description: "Understanding heap/stack memory, GC algorithms, and tuning.", difficulty: "hard" },
      ]
    }
  ]) as any[];

  // Filter out system design, mock/simulation, and foundation topics (since foundation has its own explore page)
  const filteredCategories = rawCategories.map(cat => {
    const categoryName = (cat.category || cat.category_title || "").toLowerCase();
    if (categoryName.includes("system") || categoryName.includes("design") || categoryName.includes("architecture")) {
      return null;
    }
    const filteredTopics = (cat.topics || []).filter((t: any) => {
      const id = (t.id ?? "").toLowerCase();
      const title = (t.title ?? "").toLowerCase();
      if (id.includes("system") || id.includes("design") || title.includes("system design") || title.includes("architecture")) return false;
      if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return false;
      if ((t.stage_id || "").toLowerCase() === "foundation") return false;

      // Apply filter tab
      const live = getTopicLiveProgress(t.id);
      const actualPct = live.pct;
      const cardStatus = live.status === "completed" ? "mastered" : live.status === "in-progress" ? "in-progress" : "not-started";

      if (filter === "not-started" && cardStatus !== "not-started") return false;
      if (filter === "in-progress" && cardStatus !== "in-progress") return false;
      if (filter === "mastered" && cardStatus !== "mastered") return false;

      return true;
    });

    if (filteredTopics.length === 0) return null;
    return {
      ...cat,
      topics: filteredTopics,
    };
  }).filter(Boolean) as any[];

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

      {/* Render dynamic categories */}
      {filteredCategories.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>No topics found in this category.</p>
        </div>
      ) : (
        filteredCategories.map((cat, idx) => (
          <div key={idx} style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>{cat.category || cat.category_title}</h2>
              <Badge label="CORE PREP" color={C.purpleLight} bg={C.purpleDim} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {cat.topics.map((t: any, i: number) => {
                const live = getTopicLiveProgress(t.id);
                const actualPct = live.pct;
                const cardStatus = live.status === "completed" ? "mastered" : live.status === "in-progress" ? "in-progress" : "not-started";

                return (
                  <CurriculumTopicCard
                    key={i}
                    title={t.title}
                    time="60min"
                    mastery={actualPct}
                    status={cardStatus}
                    onClick={() => {
                      markTopicStarted(t.id);
                      onNavigate("topic", { topicTitle: t.title, topicId: t.id });
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
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
function TopicLoadingStep({ step, currentStep, label }: { step: number; currentStep: number; label: string }) {
  const isDone = step < currentStep;
  const isActive = step === currentStep;

  let indicatorBg = C.border;
  let indicatorContent = null;
  let opacity = 0.5;
  let fontWeight = 400;

  if (isDone) {
    indicatorBg = C.greenLight;
    indicatorContent = Ico.check(10, C.purple);
    opacity = 1;
  } else if (isActive) {
    indicatorBg = C.purple;
    indicatorContent = (
      <div style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: C.greenLight,
        animation: "pulse 1s infinite",
      }} />
    );
    opacity = 1;
    fontWeight = 600;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, opacity, transition: "all 0.3s ease" }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: indicatorBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background 0.3s",
      }}>
        {indicatorContent}
      </div>
      <span style={{ fontSize: 13, color: C.text, fontWeight }}>
        {label}
      </span>
    </div>
  );
}

function Screen3TopicDetail({
  topicTitle,
  topicId,
  topicTasks,
  quizQuestions,
  onNavigate,
  markTopicStarted,
  markTopicCompleted,
  getTopicProgress,
  getTopicLiveProgress,
  studentId,
  targetId,
}: {
  topicTitle: string;
  topicId?: string;
  topicTasks: LearningTask[];
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  markTopicStarted: (topicId: string) => void;
  markTopicCompleted: (topicId: string) => void;
  getTopicProgress: (topicId: string) => "not_started" | "started" | "completed";
  getTopicLiveProgress: (topicId: string) => { pct: number; status: "queued" | "in-progress" | "completed" };
  studentId: number | null;
  targetId?: number | null;
}) {
  const [topicContent, setTopicContent] = useState<TopicContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicLoadingStep, setTopicLoadingStep] = useState(0);

  // STAR Method Practice state
  const [starAnswer, setStarAnswer] = useState("");
  const [starQuestion, setStarQuestion] = useState("");
  const [starEvaluating, setStarEvaluating] = useState(false);
  const [starResult, setStarResult] = useState<STAREvaluateResponse | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const [showStarPractice, setShowStarPractice] = useState(false);
  const [selectedStarQuestion, setSelectedStarQuestion] = useState<string | null>(null);
  
  // Non-coding task modal state
  const [selectedNonCodingTask, setSelectedNonCodingTask] = useState<any | null>(null);

  // Dynamic loader simulation for the premium overlay
  useEffect(() => {
    if (!loading) {
      setTopicLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setTopicLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

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
    <div className="sp-fade-up" style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
      {/* Container holding all topic content: blurred when loading */}
      <div
        style={{
          filter: loading ? "blur(6px)" : "none",
          pointerEvents: loading ? "none" : "auto",
          userSelect: loading ? "none" : "auto",
          transition: "filter 0.4s ease",
        }}
      >
        <Breadcrumb
          items={[
            { label: "Prep Plan", screen: "plan" },
            { label: "Core Prep", screen: "plan" },
            { label: topicTitle },
          ]}
          onNavigate={onNavigate}
        />

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
            {topicId ? (() => {
              const live = getTopicLiveProgress(topicId);
              if (live.status === "completed") return "Completed ✓";
              if (live.status === "in-progress") return `${live.pct}% (In Progress)`;
              return "0% (Queued)";
            })() : "0%"}
          </span>
        </div>
        <ProgressBar
          pct={topicId ? getTopicLiveProgress(topicId).pct : 0}
          color={topicId && getTopicLiveProgress(topicId).status === "completed" ? C.greenLight : C.purple}
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
          {coreConcepts.map((c, i) => {
            const isRead = typeof window !== "undefined" && studentId && targetId && topicId
              ? localStorage.getItem(`concept_read_${studentId}_${targetId}_${topicId}_${i}`) === "true"
              : false;
            return (
              <div
                key={i}
                onClick={() => !loading && onNavigate("concept", {
                  conceptTitle: c.title,
                  parentTopic: topicTitle,
                  topicId: topicId,
                  subTopicId: c.id,
                  conceptIndex: i,
                  topicContent: topicContent,
                  quizQuestions: aiQuizQuestions,
                })}
                style={{
                  background: C.card,
                  border: `1px solid ${isRead ? C.greenLight : C.border}`,
                  borderRadius: 12,
                  padding: "16px",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  position: "relative"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{c.title}</h4>
                  {isRead && <Badge label="Read" color="#000000" bg={C.greenBg} />}
                </div>
                <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 12px", lineHeight: 1.5 }}>{c.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.purpleLight }}>
                  {isRead ? "Review" : "Learn More"} {Ico.arrowRight(10)}
                </div>
              </div>
            );
          })}
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
              const isCode = p.taskType?.toLowerCase() === "code" || p.taskType?.toLowerCase() === "coding";
              const storedPct = (isCode && studentId && targetId && topicId) ? localStorage.getItem(`coding_pct_${studentId}_${targetId}_${topicId}`) : null;
              const pct = storedPct ? parseInt(storedPct) : 0;

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (isCode) {
                      const task = topicContent?.practice_tasks?.find((t: any) => 
                        t.id === p.taskId || 
                        t.task_type?.toLowerCase() === "code" || 
                        t.task_type?.toLowerCase() === "coding" ||
                        t.taskType?.toLowerCase() === "code"
                      );
                      onNavigate("coding", {
                        practiceTask: task || null,
                        topicId: topicId,
                      });
                    } else {
                      const task = topicContent?.practice_tasks?.find((t: any) => 
                        t.id === p.taskId || t.title === p.title
                      );
                      if (task) {
                        setSelectedNonCodingTask(task);
                      } else {
                        setSelectedNonCodingTask({
                          title: p.title,
                          task_type: "qa",
                          question: "Description for this task is not currently available.",
                        });
                      }
                    }
                  }}
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
          {topicContent?.practice_tasks?.some((t: any) => t.task_type?.toLowerCase() === "code" || t.task_type?.toLowerCase() === "coding") && (
            <button
            onClick={() => onNavigate("coding", {
                practiceTask: topicContent?.practice_tasks?.find(
                  (t: any) => t.task_type?.toLowerCase() === "code" || t.task_type?.toLowerCase() === "coding"
                ) ?? null,
                topicId: topicId,
              })}
              style={{ width: "100%", padding: "8px", borderRadius: 8, background: "none", border: `1px solid ${C.purpleDim}`, color: C.purpleLight, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              View All Coding Tasks
            </button>
          )}
        </div>
      </div>

      {/* Quiz CTA */}
      {aiQuizQuestions.length > 0 && (() => {
        const isQuizDone = typeof window !== "undefined" && studentId && targetId && topicId
          ? localStorage.getItem(`quiz_done_${studentId}_${targetId}_${topicId}`) === "true"
          : false;
        return (
          <div style={{ marginTop: 20, background: C.card, border: `1px solid ${isQuizDone ? C.greenLight : C.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>Test Your Understanding</h3>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{aiQuizQuestions.length} AI-generated questions for {topicTitle}</p>
            </div>
            {isQuizDone ? (
              <Badge label="Quiz Completed ✓" color={C.greenLight} bg={C.greenBg} />
            ) : (
              <button
                onClick={() => {
                  onNavigate("quiz", {
                    quizTopic: topicTitle,
                    quizQuestions: aiQuizQuestions,
                    topicId: topicId,
                    hasCodingTask: topicContent?.practice_tasks?.some((t: any) => t.task_type?.toLowerCase() === "code" || t.task_type?.toLowerCase() === "coding") ?? false,
                    onQuizComplete: () => {
                      if (studentId && targetId && topicId) {
                        localStorage.setItem(`quiz_done_${studentId}_${targetId}_${topicId}`, "true");
                        // If everything is done, mark the topic complete too!
                        const conceptsReadCount = [0, 1, 2].filter(idx => localStorage.getItem(`concept_read_${studentId}_${targetId}_${topicId}_${idx}`) === "true").length;
                        const codingPctRaw = localStorage.getItem(`coding_pct_${studentId}_${targetId}_${topicId}`);
                        const codingPct = codingPctRaw ? parseInt(codingPctRaw, 10) : 0;
                        if (conceptsReadCount === 3 && codingPct === 100) {
                          localStorage.setItem(`topic_progress_${studentId}_${targetId}_${topicId}`, "completed");
                        } else {
                          localStorage.setItem(`topic_progress_${studentId}_${targetId}_${topicId}`, "started");
                        }
                      }
                    },
                  });
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, background: C.purple, border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {Ico.book(13)} Take Quiz
              </button>
            )}
          </div>
        );
      })()}
      </div>



      {/* Premium Blur Overlay for Topic Generation */}
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(243, 243, 243, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "40px 24px",
            minHeight: "450px"
          }}
        >
          <div
            className="sp-fade-up"
            style={{
              background: C.white,
              border: `1.5px solid ${C.border}`,
              borderRadius: 20,
              padding: "40px 32px",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.08)",
              textAlign: "center",
              backdropFilter: "blur(20px)",
              animation: "fadeInUp 0.4s ease both",
              position: "relative",
            }}
          >
            {/* Back Button inside loader */}
            <div style={{ position: "absolute", top: 16, left: 16 }}>
              <button 
                onClick={() => onNavigate("plan")}
                style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontSize: 13, fontWeight: 600 }}
              >
                ← Back
              </button>
            </div>

            {/* Spinner & Zap */}
            <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: C.greenBg,
                border: `2px solid ${C.greenLight}`,
                animation: "pulse 2s infinite ease-in-out",
              }} />
              <div style={{
                position: "absolute",
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: `3px dashed ${C.purple}`,
                borderTopColor: "transparent",
                animation: "spin 1.2s linear infinite",
              }} />
              <div style={{ fontSize: 24, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>⚡</div>
            </div>

            {/* Title */}
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 10px", letterSpacing: "-0.3px" }}>
              Generating Topic Deep-Dive
            </h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 28px", lineHeight: 1.5 }}>
              AI is curating core concepts, analyzing high-yield interview traps, compiling practice tasks, and custom-generating the topic quiz.
            </p>

            {/* Dynamic Step Loader inside the card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left", padding: "0 8px" }}>
              <TopicLoadingStep step={0} currentStep={topicLoadingStep} label="Initializing topic deep-dive..." />
              <TopicLoadingStep step={1} currentStep={topicLoadingStep} label="Formulating strategic insights..." />
              <TopicLoadingStep step={2} currentStep={topicLoadingStep} label="Structuring core concepts & mechanics..." />
              <TopicLoadingStep step={3} currentStep={topicLoadingStep} label="Compiling interview traps & practice tasks..." />
              <TopicLoadingStep step={4} currentStep={topicLoadingStep} label="Finalizing custom quiz..." />
            </div>
          </div>
        </div>
      )}
      {/* -- Non-coding Task Modal -- */}
      {selectedNonCodingTask && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: C.surface,
            width: "100%",
            maxWidth: 600,
            maxHeight: "80vh",
            borderRadius: 16,
            overflowY: "auto",
            padding: 32,
            position: "relative",
            border: `1px solid ${C.border}`,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
          }}>
            <button
              onClick={() => setSelectedNonCodingTask(null)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "transparent",
                border: "none",
                fontSize: 20,
                color: C.textDim,
                cursor: "pointer"
              }}
            >
              &times;
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Badge label={selectedNonCodingTask.task_type?.toUpperCase() || "PRACTICE"} color={C.purpleLight} bg={C.purpleDim} />
              {selectedNonCodingTask.difficulty && (
                <Badge label={selectedNonCodingTask.difficulty.toUpperCase()} color={C.textDim} bg={C.border} />
              )}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>
              {selectedNonCodingTask.title}
            </h2>
            <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
              {selectedNonCodingTask.problem_statement && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Scenario:</strong><br/>
                  {selectedNonCodingTask.problem_statement}
                </div>
              )}
              {selectedNonCodingTask.question && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Question:</strong><br/>
                  {selectedNonCodingTask.question}
                </div>
              )}
              {selectedNonCodingTask.scenario && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Mock Interview Scenario:</strong><br/>
                  {selectedNonCodingTask.scenario}
                </div>
              )}
              {selectedNonCodingTask.ideal_answer_points && selectedNonCodingTask.ideal_answer_points.length > 0 && selectedNonCodingTask.ideal_answer_points[0] !== "" && (
                <div style={{ marginBottom: 16, background: C.card, padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <strong>Ideal Answer Points:</strong>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
                    {selectedNonCodingTask.ideal_answer_points.map((pt: string, i: number) => (
                      <li key={i} style={{ marginBottom: 6 }}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedNonCodingTask.evaluation_criteria && selectedNonCodingTask.evaluation_criteria.length > 0 && selectedNonCodingTask.evaluation_criteria[0] !== "" && (
                <div style={{ marginBottom: 16, background: C.card, padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <strong>Evaluation Criteria:</strong>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
                    {selectedNonCodingTask.evaluation_criteria.map((pt: string, i: number) => (
                      <li key={i} style={{ marginBottom: 6 }}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
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
  topicId,
  conceptIndex,
  studentId,
  targetId,
  onConceptRead,
}: {
  conceptTitle: string;
  parentTopic: string;
  conceptTask?: LearningTask | null;
  topicContent?: TopicContent | null;
  subTopicId?: string;
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  topicId?: string;
  conceptIndex?: number;
  studentId?: number | null;
  targetId?: number | null;
  onConceptRead?: () => void;
}) {
  // Find the specific sub-topic content from Prompt 2 output
  const subTopicContent = topicContent?.core_concepts?.find(
    c => c.id === subTopicId || c.title === conceptTitle
  );

  // Mark concept read on mount
  useEffect(() => {
    if (studentId && targetId && topicId && typeof conceptIndex === "number") {
      const key = `concept_read_${studentId}_${targetId}_${topicId}_${conceptIndex}`;
      if (localStorage.getItem(key) !== "true") {
        localStorage.setItem(key, "true");
        if (onConceptRead) onConceptRead();
        
        // Also ensure topic status shifts from QUEUED to IN PROGRESS since student started learning
        const topicKey = `topic_progress_${studentId}_${targetId}_${topicId}`;
        if (!localStorage.getItem(topicKey)) {
          localStorage.setItem(topicKey, "started");
        }
      }
    }
  }, [studentId, targetId, topicId, conceptIndex, onConceptRead]);

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
  const [targetId, setTargetId] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState<keyof typeof LANGUAGE_CONFIGS>("python");
  const [code, setCode] = useState(() =>
    LANGUAGE_CONFIGS.python.starter(problemTitle, practiceTask?.method_signatures)
  );
  const [activeTab, setActiveTab] = useState<"console" | "output" | "tests">("tests");
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ label: string; passed: boolean; input: string; expected: string; got: string; stderr?: string | null; execution_time?: string | null }[]>([]);
  const [allTestsVisible, setAllTestsVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(42 * 60 + 15);
  const [showHint, setShowHint] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    const sid = sessionStorage.getItem("student_id");
    if (sid) setStudentId(Number(sid));
    const tid = sessionStorage.getItem("target_id");
    if (tid) setTargetId(Number(tid));
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

  const handleRunTests = async () => {
    if (visibleTests.length === 0) {
      setExecError("No test cases available. The AI needs to generate them first.");
      setActiveTab("console");
      return;
    }
    setRunning(true);
    setActiveTab("tests");
    setExecError(null);
    setConsoleOutput("");

    try {
      const response = await executeCode({
        language: selectedLang,
        source_code: code,
        test_cases: visibleTests.map(tc => ({
          label: tc.label || "Test",
          input: tc.input,
          expected_output: tc.expected_output,
        })),
        problem_title: problemTitle,
      });

      const results = response.results.map(r => ({
        label: r.label,
        passed: r.passed,
        input: r.input,
        expected: r.expected,
        got: r.got,
        stderr: r.stderr,
        execution_time: r.execution_time,
      }));
      setTestResults(results);

      // Build console output from stderr / compile errors
      const consoleLines = response.results
        .filter(r => r.stderr || r.compile_error)
        .map(r => `[${r.label}] ${r.compile_error || r.stderr || ""}`.trim())
        .join("\n");
      setConsoleOutput(consoleLines);

      // Progressive reveal: if all visible tests pass, unlock remaining tests and auto-run them
      const allPassed = results.every(r => r.passed);
      if (allPassed && !allTestsVisible && allTestCases.length > INITIAL_VISIBLE) {
        // Unlock all tests
        setAllTestsVisible(true);
        // Auto-run the remaining tests after a short pause (lets Judge0 rate limit recover)
        setTimeout(async () => {
          const remainingTests = allTestCases.slice(INITIAL_VISIBLE);
          try {
            const remainingResponse = await executeCode({
              language: selectedLang,
              source_code: code,
              test_cases: remainingTests.map(tc => ({
                label: tc.label || "Test",
                input: tc.input,
                expected_output: tc.expected_output,
              })),
              problem_title: problemTitle,
            });
            const remainingResults = remainingResponse.results.map(r => ({
              label: r.label,
              passed: r.passed,
              input: r.input,
              expected: r.expected,
              got: r.got,
              stderr: r.stderr,
              execution_time: r.execution_time,
            }));
            // Merge: first 2 results + remaining results
            setTestResults(prev => [...prev, ...remainingResults]);
          } catch {
            // If remaining tests fail to run, just show them as unlocked (user can retry)
          }
        }, 2000);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Code execution failed. Check your internet connection.";
      setExecError(msg);
      setConsoleOutput(msg);
      setActiveTab("console");
    } finally {
      setRunning(false);
    }
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
    if (studentId && targetId && topicId) {
      // Save coding progress percentage in localStorage
      localStorage.setItem(`coding_pct_${studentId}_${targetId}_${topicId}`, String(progressPct));
      localStorage.setItem(`coding_passed_${studentId}_${targetId}_${topicId}`, String(passedCount));
      localStorage.setItem(`coding_total_${studentId}_${targetId}_${topicId}`, String(allTestCases.length));
      
      // Calculate overall completeness to set topic progress correctly
      const conceptsReadCount = [0, 1, 2].filter(idx => localStorage.getItem(`concept_read_${studentId}_${targetId}_${topicId}_${idx}`) === "true").length;
      const quizDone = localStorage.getItem(`quiz_done_${studentId}_${targetId}_${topicId}`) === "true";
      
      if (conceptsReadCount === 3 && progressPct === 100 && quizDone) {
        localStorage.setItem(`topic_progress_${studentId}_${targetId}_${topicId}`, "completed");
      } else {
        localStorage.setItem(`topic_progress_${studentId}_${targetId}_${topicId}`, "started");
      }
    }
    onNavigate("topic");
  };

  return (
    <div className="sp-fade-up" style={{ minHeight: "calc(100vh - 160px)", display: "flex", flexDirection: "column" as const }}>
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
            {(!practiceTask || problemStatement === "Solve the coding problem below.") ? (
              <div style={{ padding: "16px", background: "rgba(99,71,255,0.05)", border: "1.5px dashed rgba(99,71,255,0.2)", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.purpleLight, marginBottom: 6 }}>⚠️ No AI problem loaded</div>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
                  The AI-generated problem description and test cases were not passed to this screen.<br />
                  Please go <strong>Back</strong> to the topic page and click the coding practice task again — it should now load properly after the cache has been cleared.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 14 }}>{problemStatement}</p>
            )}

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
              {activeTab === "console" && (
                <pre style={{ fontSize: 12, color: execError ? C.red : C.textDim, fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const }}>
                  {consoleOutput || (execError ? execError : "Console output will appear here after you run tests...")}
                </pre>
              )}
              {activeTab === "output" && (
                <div>
                  {testResults.length === 0 ? (
                    <p style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", margin: 0 }}>Run tests to see output...</p>
                  ) : (
                    testResults.map((r, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: "6px 10px", background: r.passed ? "rgba(217,243,110,0.15)" : "rgba(220,38,38,0.07)", borderRadius: 8, border: `1px solid ${r.passed ? "rgba(217,243,110,0.4)" : "rgba(220,38,38,0.2)"}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: r.passed ? "#22aa55" : C.red, marginBottom: 3 }}>{r.passed ? "✓" : "✗"} {r.label}</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: C.textMuted }}>Your output: <code>{r.got || "(empty)"}</code></div>
                        {!r.passed && <div style={{ fontSize: 11, fontFamily: "monospace", color: C.amber }}>Expected: <code>{r.expected}</code></div>}
                        {r.execution_time && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Time: {r.execution_time}s</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
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
                              color: allTestsVisible ? C.text : C.textDim, 
                              padding: "6px 10px", 
                              background: allTestsVisible ? C.surface : "rgba(0,0,0,0.01)", 
                              border: `1.5px ${allTestsVisible ? "solid" : "dashed"} ${allTestsVisible ? C.border : C.border}`,
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}>
                              <span>
                                <strong>{tc.label || `Test ${i + 1}`}:</strong> <code style={{ background: "rgba(0,0,0,0.02)", padding: "2px 4px", borderRadius: 4 }}>{tc.input}</code>
                              </span>
                              {allTestsVisible ? (
                                <span style={{ fontSize: 10, color: C.purpleLight, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                                  <div style={{ width: 10, height: 10, border: `2px solid ${C.purpleLight}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                  Running…
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                                  🔒 Locked
                                </span>
                              )}
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
                          🚀 <strong>Initial 2 tests passed!</strong> Unlocking and running the remaining {allTestCases.length - INITIAL_VISIBLE} advanced test cases automatically…
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
  getTopicLiveProgress,
  markTopicStarted,
}: {
  company: string;
  role: string;
  dynamicPlan: PlanDetailResponse | null;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  getTopicLiveProgress: (topicId: string) => { pct: number; status: "queued" | "in-progress" | "completed" };
  markTopicStarted: (topicId: string) => void;
}) {
  // Get behavioral stage from AI plan
  const behavioralStage = dynamicPlan?.plan_json?.roadmap_stages?.find(
    s => s.id?.includes("behavioral") || s.title?.toLowerCase().includes("behavioral") || s.title?.toLowerCase().includes("leadership")
  );

  // Get behavioral topics from AI curriculum
  const allTopics = (dynamicPlan?.plan_json?.curriculum ?? []).flatMap(c => c.topics).filter(t => {
    const id = (t.id ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    if (id.includes("system") || id.includes("design") || title.includes("system design") || title.includes("architecture")) return false;
    if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return false;
    return true;
  });
  const behavioralTopics = allTopics.filter(t =>
    t.id?.includes("behavioral") || t.id?.includes("star") || t.id?.includes("communication") ||
    t.title?.toLowerCase().includes("behavioral") || t.title?.toLowerCase().includes("star") ||
    t.title?.toLowerCase().includes("communication") || t.title?.toLowerCase().includes("leadership") ||
    t.title?.toLowerCase().includes("hr") ||
    t.stage_id?.toLowerCase().includes("behavioral") || t.stage_id?.toLowerCase().includes("leadership")
  );
  const finalBehavioralTopics = behavioralTopics;

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
        <Badge label="Phase 3" color={C.purpleLight} bg={C.purpleDim} />
      </div>

      {/* Behavioral topics from AI curriculum */}
      {finalBehavioralTopics.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 14px" }}>Behavioral Topics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {finalBehavioralTopics.map((topic, i) => (
              <div
                key={i}
                onClick={() => {
                  markTopicStarted(topic.id);
                  onNavigate("topic", { topicTitle: topic.title, topicId: topic.id });
                }}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{topic.title}</h4>
                  <Badge label={topic.roi_label === "high" ? "High ROI" : "Medium ROI"} color={topic.roi_label === "high" ? C.purpleLight : C.amber} bg={topic.roi_label === "high" ? C.purpleDim : C.amberBg} />
                </div>
                <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 10px", lineHeight: 1.5 }}>{topic.description}</p>
                {(() => {
                  const live = getTopicLiveProgress(topic.id);
                  if (live.status === "completed") {
                    return <Badge label="Completed ✓" color={C.greenLight} bg={C.greenBg} />;
                  } else if (live.status === "in-progress") {
                    return (
                      <div style={{ width: "100%", marginTop: 4, marginBottom: 8 }}>
                        <ProgressBar pct={live.pct} color={C.purple} />
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{live.pct}% complete</div>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.purpleLight }}>
                        Study Now {Ico.arrowRight(10)}
                      </div>
                    );
                  }
                })()}
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
  onQuizComplete,
  hasCodingTask,
}: {
  quizTopic: string;
  quizQuestions?: Array<{question: string; options: string[]; correct_index: number; explanation: string}>;
  onNavigate: (s: string, extra?: Record<string, unknown>) => void;
  onQuizComplete?: () => void;
  hasCodingTask?: boolean;
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

  useEffect(() => {
    if (finished) {
      onQuizComplete?.();
    }
  }, [finished, onQuizComplete]);

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
            {pct >= 80 ? "ðŸŽ‰" : pct >= 60 ? "ðŸ‘ " : "ðŸ“š"}
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
            {hasCodingTask && (
              <button
                onClick={() => onNavigate("coding")}
                style={{ padding: "10px 24px", borderRadius: 10, background: "none", border: `1px solid #d9f36e`, color: "#555555", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {Ico.code(13)} Start Coding Task
              </button>
            )}
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
  extra?: Record<string, any>;
  practiceTask?: any;
  topicId?: any;
  quizTopic?: any;
  quizQuestions?: any;
  onQuizComplete?: any;
}

export default function StudyPlanPage() {
  const router = useRouter();

  // -- Session state --
  const [studentId, setStudentId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [company, setCompany] = useState("Google");
  const [role, setRole] = useState("Senior L5 Backend");

  // -- Topic progress tracking (localStorage) — reactive via progressVersion --
  const [progressVersion, setProgressVersion] = useState(0);

  // -- Plan state --
  const [dynamicPlan, setDynamicPlan] = useState<PlanDetailResponse | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [planError, setPlanError] = useState<string | null>(null);
  // -- Whether the generating overlay is visible (can be dismissed while generation continues) --
  const [showGeneratingOverlay, setShowGeneratingOverlay] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Navigation state --
  const [nav, setNav] = useState<NavState>({ screen: "plan" });

  // -- Feedback modal --
  const [showFeedback, setShowFeedback] = useState(false);

  // -- Countdown (days left) --
  const [daysLeft, setDaysLeft] = useState(14);

  // -- Active loading step for generating state overlay --
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  // -- Show overlay again whenever a new generation starts --
  // Resets the overlay visibility whenever planStatus changes to generating
  useEffect(() => {
    if (planStatus === "generating") setShowGeneratingOverlay(true);
  }, [planStatus]);

  const markTopicStarted = useCallback((topicId: string) => {
    if (!studentId || !targetId || !topicId) return;
    const key = `topic_progress_${studentId}_${targetId}_${topicId}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "started");
      setProgressVersion(v => v + 1);
    }
  }, [studentId, targetId]);

  const markTopicCompleted = useCallback((topicId: string) => {
    if (!studentId || !targetId || !topicId) return;
    localStorage.setItem(`topic_progress_${studentId}_${targetId}_${topicId}`, "completed");
    setProgressVersion(v => v + 1);
  }, [studentId, targetId]);

  const clearStudentProgress = useCallback((sid: number, tid?: number | null) => {
    if (typeof window === "undefined" || !sid) return;
    const keysToRemove: string[] = [];
    Object.keys(localStorage).forEach((key) => {
      if (!key) return;
      
      const parts = key.split("_");
      
      // 1. foundation_quiz_done_${studentId}_${targetId}
      if (key.startsWith("foundation_quiz_done_")) {
        const keySid = Number(parts[3]);
        const keyTid = Number(parts[4]);
        if (keySid === sid && (!tid || keyTid === tid)) keysToRemove.push(key);
      }
      // 2. concept_read_${studentId}_${targetId}_${topicId}_${i}
      else if (key.startsWith("concept_read_")) {
        const keySid = Number(parts[2]);
        const keyTid = Number(parts[3]);
        if (keySid === sid && (!tid || keyTid === tid)) keysToRemove.push(key);
      }
      // 3. Topic progress and task metrics
      else if (
        key.startsWith("topic_progress_") ||
        key.startsWith("coding_pct_") ||
        key.startsWith("coding_passed_") ||
        key.startsWith("coding_total_") ||
        key.startsWith("quiz_done_") ||
        key.startsWith("quiz_score_") ||
        key.startsWith("coding_code_")
      ) {
        const keySid = Number(parts[2]);
        const keyTid = Number(parts[3]);
        if (keySid === sid && (!tid || keyTid === tid)) keysToRemove.push(key);
      }
      // 4. stage_progress_${studentId}_${stageId}
      else if (key.startsWith("stage_progress_")) {
        const keySid = Number(parts[2]);
        if (keySid === sid) keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setProgressVersion(v => v + 1);
  }, []);


  const getTopicLiveProgress = useCallback((topicId: string) => {
    if (!studentId || !targetId || !topicId) return { pct: 0, status: "queued" as const };
    
    // Check if topic is completed explicitly or by progress
    const isTopicCompletedKey = `topic_progress_${studentId}_${targetId}_${topicId}`;
    const topicStatusRaw = localStorage.getItem(isTopicCompletedKey);
    
    // STRICT QUEUED FALLBACK: If never explicitly started or completed, it remains queued with 0% progress!
    if (!topicStatusRaw) {
      return { pct: 0, status: "queued" as const };
    }
    
    // 1. Concepts done (3 concepts: indices 0, 1, 2)
    let conceptsReadCount = 0;
    for (let i = 0; i < 3; i++) {
      if (localStorage.getItem(`concept_read_${studentId}_${targetId}_${topicId}_${i}`) === "true") {
        conceptsReadCount++;
      }
    }
    
    // 2. Coding Sandbox Done (%)
    const codingPctRaw = localStorage.getItem(`coding_pct_${studentId}_${targetId}_${topicId}`);
    const codingPct = codingPctRaw ? parseInt(codingPctRaw, 10) : 0;
    
    // 3. Quiz Done (boolean)
    const quizDone = localStorage.getItem(`quiz_done_${studentId}_${targetId}_${topicId}`) === "true";
    
    const conceptsContribution = conceptsReadCount * 20;
    const codingContribution = Math.round(codingPct * 0.2);
    const quizContribution = quizDone ? 20 : 0;
    let computedPct = conceptsContribution + codingContribution + quizContribution;
    computedPct = Math.min(100, Math.max(0, computedPct));
    
    // Determine status
    let status: "queued" | "in-progress" | "completed" = "queued";
    if (topicStatusRaw === "completed" || computedPct === 100) {
      status = "completed";
      computedPct = 100;
    } else if (topicStatusRaw === "started" || topicStatusRaw === "in-progress") {
      status = "in-progress";
    }
    
    return { pct: computedPct, status };
  }, [studentId, targetId, progressVersion]);

  const getTopicProgress = useCallback((topicId: string): "not_started" | "started" | "completed" => {
    const live = getTopicLiveProgress(topicId);
    if (live.status === "completed") return "completed";
    if (live.status === "in-progress") return "started";
    return "not_started";
  }, [getTopicLiveProgress]);

  // Gather all unique topic IDs
  const getAllStudyPlanTopics = useCallback((): string[] => {
    const list: string[] = [];
    if (dynamicPlan?.plan_json?.curriculum) {
      dynamicPlan.plan_json.curriculum.forEach((cat: any) => {
        (cat.topics || []).forEach((t: any) => {
          const id = (t.id ?? "").toLowerCase();
          const title = (t.title ?? "").toLowerCase();
          if (id.includes("system") || id.includes("design") || title.includes("system design") || title.includes("architecture")) return;
          if (id.includes("mock") || id.includes("simulation") || title.includes("mock") || title.includes("simulation")) return;
          if (!list.includes(t.id)) {
            list.push(t.id);
          }
        });
      });
    }
    
    // Default topics removed to enforce AI-only modules
    
    return list;
  }, [dynamicPlan]);

  // -- Load session --
  useEffect(() => {
    const sid = sessionStorage.getItem("student_id");
    const tid = sessionStorage.getItem("target_id");
    const co = sessionStorage.getItem("company_name");
    const ro = sessionStorage.getItem("role");
    const iDate = sessionStorage.getItem("interview_date");

    if (!sid) { router.replace("/login"); return; }
    const sidNum = Number(sid);
    const tidNum = tid ? Number(tid) : null;
    setStudentId(sidNum);
    if (tidNum) setTargetId(tidNum);
    if (co) setCompany(co);
    if (ro) setRole(ro);

    if (iDate) {
      const diff = Math.ceil((new Date(iDate).getTime() - Date.now()) / 86400000);
      setDaysLeft(Math.max(0, diff));
    }

    if (sessionStorage.getItem("target_activated") === "true") {
      clearStudentProgress(sidNum, tidNum);
      sessionStorage.removeItem("target_activated");
    }
  }, [router, clearStudentProgress]);

  // -- Hydrate Progress from DB --
  useEffect(() => {
    if (!studentId || !targetId) return;
    (async () => {
      try {
        const progressList = await getStudyProgress(studentId, targetId);
        let changed = false;
        progressList.forEach((p) => {
          localStorage.setItem(`topic_progress_${studentId}_${targetId}_${p.topic_id}`, p.status);
          localStorage.setItem(`coding_pct_${studentId}_${targetId}_${p.topic_id}`, String(p.coding_pct || 0));
          if (p.quiz_done) {
            localStorage.setItem(`quiz_done_${studentId}_${targetId}_${p.topic_id}`, "true");
          }
          if (p.concepts_read_count) {
            for (let i = 0; i < p.concepts_read_count; i++) {
              localStorage.setItem(`concept_read_${studentId}_${targetId}_${p.topic_id}_${i}`, "true");
            }
          }
          changed = true;
        });
        if (changed) setProgressVersion(v => v + 1);
      } catch (e) {
        console.error("Failed to hydrate progress", e);
      }
    })();
  }, [studentId, targetId]);

  // -- Sync Progress to DB --
  useEffect(() => {
    if (!studentId || !targetId || progressVersion === 0) return;
    
    const timeout = setTimeout(async () => {
      const allTopicIds = getAllStudyPlanTopics();
      const updates = allTopicIds.map(topicId => {
        const live = getTopicLiveProgress(topicId);
        const codingPctRaw = localStorage.getItem(`coding_pct_${studentId}_${targetId}_${topicId}`);
        const codingPct = codingPctRaw ? parseInt(codingPctRaw, 10) : 0;
        const quizDone = localStorage.getItem(`quiz_done_${studentId}_${targetId}_${topicId}`) === "true";
        
        let conceptsReadCount = 0;
        for (let i = 0; i < 3; i++) {
          if (localStorage.getItem(`concept_read_${studentId}_${targetId}_${topicId}_${i}`) === "true") {
            conceptsReadCount++;
          }
        }
        
        return {
          topic_id: topicId,
          status: live.status === "in-progress" ? "started" : live.status,
          coding_pct: codingPct,
          quiz_done: quizDone,
          concepts_read_count: conceptsReadCount
        };
      }).filter(u => u.status === "started" || u.status === "completed");
      
      if (updates.length === 0) return;
      
      try {
        await syncTopicProgress(studentId, targetId, { updates });
      } catch (e) {
        console.error("Failed to sync progress", e);
      }
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [progressVersion, studentId, targetId, getAllStudyPlanTopics, getTopicLiveProgress]);


  // -- Detect active target company switch --
  useEffect(() => {
    if (!studentId || !targetId) return;
    const key = `last_target_id_${studentId}`;
    const lastTargetId = localStorage.getItem(key);
    const currentTargetId = String(targetId);
    
    if (lastTargetId !== currentTargetId) {
      // The student switched target companies or loaded a new one!
      // We don't wipe progress here because target-scoped keys isolate them perfectly!
      localStorage.setItem(key, currentTargetId);
    }
  }, [studentId, targetId]);

  const loadPlanAndCheckStale = useCallback((plan: PlanDetailResponse) => {
    setDynamicPlan(plan);
    setPlanStatus("ready");
    if (!studentId || !targetId) return;
    const planKey = `last_plan_id_${studentId}_${targetId}`;
    const lastPlanId = localStorage.getItem(planKey);
    const currentPlanId = String(plan.plan_id);
    if (lastPlanId !== currentPlanId) {
      // New plan for this target — reset this target's progress
      clearStudentProgress(studentId, targetId);
      localStorage.setItem(planKey, currentPlanId);
    }
  }, [studentId, targetId, clearStudentProgress]);

  // -- Load plan &mdash; auto-generate if idle --
  useEffect(() => {
    if (!studentId || !targetId) return;
    (async () => {
      setPlanStatus("generating");
      try {
        const status = await getPrepStatus(studentId, targetId);
        if (status.status === "ready") {
          const plan = await getLatestPrep(studentId, targetId);
          loadPlanAndCheckStale(plan);
        } else if (status.status === "generating") {
          setPlanStatus("generating");
          startPolling(studentId, targetId);
        } else {
          // Auto-generate instead of showing a button
          setPlanStatus("generating");
          clearStudentProgress(studentId, targetId);
          try { await generatePrep(studentId); } catch { /* silent */ }
          startPolling(studentId, targetId);
        }
      } catch {
        setPlanStatus("failed");
        setPlanError("Could not load study plan status. Please refresh the page.");
      }
    })();
    return () => stopPolling();
  }, [studentId, targetId, loadPlanAndCheckStale, clearStudentProgress]);


  // -- Cycle loading steps during plan generation --
  useEffect(() => {
    if (planStatus !== "generating") {
      setLoadingStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, [planStatus]);

  const startPolling = useCallback((sid: number, tid: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPrepStatus(sid, tid);
        if (status.status === "ready") {
          stopPolling();
          const plan = await getLatestPrep(sid, tid);
          loadPlanAndCheckStale(plan);
        } else if (status.status === "failed") {
          stopPolling();
          setPlanStatus("failed");
          setPlanError("Plan generation failed. Please try again.");
        }
      } catch {
        // keep polling
      }
    }, 3000);
  }, [loadPlanAndCheckStale]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleGenerate = async () => {
    if (!studentId || !targetId) return;
    setPlanStatus("generating");
    setPlanError(null);
    try {
      clearStudentProgress(studentId, targetId);
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
      clearStudentProgress(studentId, targetId);
      setDynamicPlan(null);
      setPlanStatus("idle");
    } catch {
      // silent
    }
  };

  // -- Navigation helper --
  const navigate = (screen: string, extra?: Record<string, any>) => {
    setProgressVersion(v => v + 1);
    setNav({ screen: screen as Screen, ...(extra || {}), extra });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // -- Readiness score (from AI plan or default) --
  const readinessPct = (() => {
    if (!dynamicPlan) return 0;
    const allTopicIds = getAllStudyPlanTopics();
    if (allTopicIds.length === 0) return 0;
    
    let totalPct = 0;
    allTopicIds.forEach(id => {
      totalPct += getTopicLiveProgress(id).pct;
    });
    return Math.round(totalPct / allTopicIds.length);
  })();

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
            targetId={targetId}
            getTopicProgress={getTopicProgress}
            getTopicLiveProgress={getTopicLiveProgress}
            markTopicStarted={markTopicStarted}
          />
        );
      case "foundation":
        return (
          <Screen0Foundation
            company={company}
            role={role}
            dynamicPlan={dynamicPlan}
            studentId={studentId}
            targetId={targetId}
            getTopicProgress={getTopicProgress}
            getTopicLiveProgress={getTopicLiveProgress}
            markTopicStarted={markTopicStarted}
            onNavigate={(s, extra) => {
              // If navigating to quiz from foundation, pass completion callback
              if (s === "quiz") {
                navigate(s, {
                  ...extra,
                  onQuizComplete: () => {
                    if (typeof window !== "undefined" && studentId && targetId) {
                      localStorage.setItem(`foundation_quiz_done_${studentId}_${targetId}`, "true");
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
        return (
          <Screen2Curriculum
            dynamicPlan={dynamicPlan}
            getTopicProgress={getTopicProgress}
            getTopicLiveProgress={getTopicLiveProgress}
            studentId={studentId}
            onNavigate={navigate}
            markTopicStarted={markTopicStarted}
          />
        );
      case "topic":
        return (
          <Screen3TopicDetail
            topicTitle={nav.extra?.topicTitle as string}
            topicId={nav.extra?.topicId as string}
            topicTasks={nav.extra?.topicTasks as LearningTask[] ?? []}
            quizQuestions={nav.extra?.quizQuestions as any}
            onNavigate={navigate}
            markTopicStarted={markTopicStarted}
            markTopicCompleted={markTopicCompleted}
            getTopicProgress={getTopicProgress}
            getTopicLiveProgress={getTopicLiveProgress}
            studentId={studentId}
            targetId={targetId}
          />
        );
      case "concept":
        return (
          <Screen4ConceptDetail
            conceptTitle={nav.extra?.conceptTitle as string}
            parentTopic={nav.extra?.parentTopic as string}
            conceptTask={nav.extra?.conceptTask as LearningTask}
            topicContent={nav.extra?.topicContent as TopicContent}
            subTopicId={nav.extra?.subTopicId as string}
            quizQuestions={nav.extra?.quizQuestions as any}
            onNavigate={navigate}
            topicId={nav.extra?.topicId as string}
            conceptIndex={nav.extra?.conceptIndex as number}
            studentId={studentId}
            targetId={targetId}
            onConceptRead={() => setProgressVersion(v => v + 1)}
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
            getTopicLiveProgress={getTopicLiveProgress}
            markTopicStarted={markTopicStarted}
          />
        );
      case "coding":
        return (
          <Screen6Coding
            onNavigate={navigate}
            practiceTask={nav.practiceTask || nav.extra?.practiceTask}
            topicId={nav.topicId || nav.extra?.topicId}
          />
        );
      case "quiz":
        return (
          <Screen7Quiz
            quizTopic={nav.quizTopic || nav.extra?.quizTopic || "Technical Quiz"}
            quizQuestions={nav.quizQuestions || nav.extra?.quizQuestions}
            onNavigate={navigate}
            onQuizComplete={nav.onQuizComplete || nav.extra?.onQuizComplete}
            hasCodingTask={nav.extra?.hasCodingTask as boolean | undefined}
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
          position: "relative",
        }}
      >
        {/* Main Content Container: blurred only when overlay is visible */}
        <div
          style={{
            filter: (planStatus === "generating" && showGeneratingOverlay) ? "blur(6px)" : "none",
            pointerEvents: (planStatus === "generating" && showGeneratingOverlay) ? "none" : "auto",
            userSelect: (planStatus === "generating" && showGeneratingOverlay) ? "none" : "auto",
            transition: "filter 0.4s ease",
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
        </div>

        {/* -- Blur Overlay for Generation -- */}
        {planStatus === "generating" && showGeneratingOverlay && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(243, 243, 243, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "40px 24px",
            }}
          >
            <div
              className="sp-fade-up"
              style={{
                background: C.white,
                border: `1.5px solid ${C.border}`,
                borderRadius: 20,
                padding: "40px 32px",
                maxWidth: 480,
                width: "100%",
                boxShadow: "0 24px 48px rgba(0, 0, 0, 0.08)",
                textAlign: "center" as const,
                backdropFilter: "blur(20px)",
                animation: "fadeInUp 0.4s ease both",
              }}
            >
              {/* Spinner & Logo Area */}
              <div style={{ position: "relative" as const, width: 80, height: 80, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* Large outer pulsing circle */}
                <div style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: C.greenBg,
                  border: `2px solid ${C.greenLight}`,
                  animation: "pulse 2s infinite ease-in-out",
                }} />
                {/* Mid spinning gradient/dashed ring */}
                <div style={{
                  position: "absolute",
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  border: `3px dashed ${C.purple}`,
                  borderTopColor: "transparent",
                  animation: "spin 1.2s linear infinite",
                }} />
                {/* Center visual icon */}
                <div style={{ fontSize: 24, zIndex: 2 }}>⚡</div>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 10px", letterSpacing: "-0.3px" }}>
                Architecting Your Study Plan
              </h2>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 28px", lineHeight: 1.5 }}>
                Our AI is matching your resume highlights and skills against the target JD requirements at <strong>{company}</strong> for the <strong>{role}</strong> position.
              </p>

              {/* Loading Steps */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 14, textAlign: "left" as const, padding: "0 8px" }}>
                {[
                  `Analyzing target profile at ${company}...`,
                  "Evaluating resume & baseline DSA skills...",
                  "Customizing high-ROI technical topics...",
                  "Assembling system design simulations...",
                  "Generating final study plan structure..."
                ].map((stepText, idx) => {
                  const isDone = idx < loadingStepIndex;
                  const isActive = idx === loadingStepIndex;
                  const isPending = idx > loadingStepIndex;

                  let indicatorBg = C.border;
                  let indicatorContent = null;
                  let opacity = 0.5;
                  let fontWeight = 400;

                  if (isDone) {
                    indicatorBg = C.greenLight;
                    indicatorContent = Ico.check(10, C.purple);
                    opacity = 1;
                  } else if (isActive) {
                    indicatorBg = C.purple;
                    indicatorContent = (
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: C.greenLight,
                        animation: "pulse 1s infinite",
                      }} />
                    );
                    opacity = 1;
                    fontWeight = 600;
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        opacity,
                        transition: "all 0.3s ease",
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: indicatorBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "background 0.3s",
                      }}>
                        {indicatorContent}
                      </div>
                      <span style={{ fontSize: 13, color: C.text, fontWeight }}>
                        {stepText}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Back button — generation continues in background */}
              <button
                onClick={() => router.back()}
                style={{
                  marginTop: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 22px",
                  borderRadius: 10,
                  background: "none",
                  border: `1.5px solid ${C.border}`,
                  color: C.textMuted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.purple; (e.currentTarget as HTMLButtonElement).style.color = C.purple; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted; }}
              >
                {Ico.arrowLeft(12)} Back
              </button>
              <p style={{ fontSize: 11, color: C.textDim, marginTop: 10, marginBottom: 0 }}>
                Your study plan generates in the background
              </p>
            </div>
          </div>
        )}

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
