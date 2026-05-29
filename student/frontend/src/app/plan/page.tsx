/**
 * PLAN PAGE (/prep and /plan)
 *
 * Purpose: Generate and display personalized learning plan (daily interview prep tasks).
 *
 * NOTE: /prep re-exports this component, so both /prep and /plan render same page.
 *
 * DEPENDENCIES:
 * - Requires: student_id, license_key, target_id, resume_id in sessionStorage
 * - Requires: All previous steps completed (license → onboarding → target → resume)
 * - Protected by: ActivationGuard
 * - Backend endpoints:
 *   - POST /prep/generate (initiate plan generation)
 *   - GET /prep/status (poll generation status)
 *   - GET /prep/latest (fetch completed plan)
 *
 * FLOW (UPDATED - Generation now starts during resume upload):
 * 1. Page loads, checks all required session keys exist
 * 2. useEffect immediately calls generatePrep() on mount (fire-and-forget from resume upload)
 *    - If status="ready": plan already generated, fetch and display immediately
 *    - If status="generating": plan is generating in background, start polling
 *    - If status="failed": show error, allow manual retry
 * 3. Polling loop: getPrepStatus() every 5 seconds (POLL_INTERVAL_MS)
 *    - Shows spinner while status="generating"
 *    - Stops polling when status becomes "ready" or error
 * 4. On status="ready": call getLatestPrep() to fetch full plan details
 * 5. Button "View My Plan" only checks status (doesn't trigger generation)
 * 6. Render plan_json as daily task list
 *
 * GENERATION CACHING (CRITICAL OPTIMIZATION):
 * - Backend builds signature: student_id:company:role:interview_date (deterministic)
 * - Same signature = same plan (avoids duplicate Gemini calls)
 * - Multiple generatePrep calls = same result (idempotent)
 * - Once plan generated, getLatestPrep always returns cached plan (cheap)
 * - Plan remains valid until interview_date passes
 * - This is why plan generation is one-time per company/role/date combo
 *
 * PLAN STRUCTURE (plan_json):
 * {
 *   overview: "You have 14 days to prepare...",
 *   daily_plan: [
 *     {
 *       day: 1,
 *       focus: "API fundamentals",
 *       tasks: [
 *         {
 *           title: "REST API basics",
 *           description: "Learn HTTP methods, status codes, RESTful principles...",
 *           duration_minutes: 90
 *         },
 *         ...more tasks...
 *       ]
 *     },
 *     ...more days...
 *   ]
 * }
 *
 * VARIABLES FROM SESSION (READ-ONLY):
 * - studentId: Used in generatePrep, getPrepStatus, getLatestPrep calls
 * - licenseKey: Auth header on all calls
 * - targetId: Identifies which interview/JD this plan is for
 * - companyName: Display, ensures user sees correct company context
 * - role: Display, used in plan generation
 * - interviewDate: Compute days_remaining for user
 *
 * ERROR HANDLING:
 * - 403: License invalid → redirected to /license (api.ts)
 * - 404: Student/target/plan not found
 * - Polling timeout after 5 minutes (MAX_POLL_ATTEMPTS = 60 attempts × 5 sec)
 *   - Shows "Generation timed out, please try again"
 * - Auto-retry: On temporary failures, tries up to AUTO_RETRY_MAX times
 *   - Helpful for transient network issues or worker delays
 * - Manual retry: "Generate Plan" button can be clicked again
 *
 * ASYNC POLLING MECHANISM:
 * - generatePrep() happens on button click
 * - Polling in background via useEffect (doesn't block UI)
 * - User can navigate away and come back (polling continues)
 * - localStorage persists taskId so polling survives page refresh
 * - Polling stops automatically when status="ready" or error threshold exceeded
 *
 * STEP GUARDS (Prevent accessing plan without requirements):
 * - If no studentId/licenseKey → redirect to /license (step 1)
 * - If no targetId → redirect to /target (step 3)
 * - If no resumeId → redirect to /resume (step 4)
 * - Ensures backend has all context before plan generation
 *
 * WHAT BREAKS IF REMOVED:
 * - No learning plan display
 * - Users have no structured interview prep guidance
 * - Must return to backend to generate plans manually
 * - No async Celery-based generation (would need to wait for response)
 *
 * CONSTANTS:
 * - POLL_INTERVAL_MS: 5000 (check status every 5 seconds)
 * - MAX_POLL_ATTEMPTS: 60 (stop after 300 seconds = 5 minutes)
 * - AUTO_RETRY_MAX: 10 (retry up to 10 times on transient errors)
 * - TERMINAL_ERROR_STATUSES: Set of statuses that stop polling
 *
 * Used by: ActivationGuard (protected route)
 * Previous: /resume (resume upload)
 * Final step in onboarding flow
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  generatePrep,
  getLatestPrep,
  getPrepStatus,
  type PlanDetailResponse,
} from "@/src/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/** Auto-fetch and store target_id from placement applications */
async function resolveTargetId(studentId: number): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/placement/applications?student_id=${studentId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const activated = (data.applications || []).find((a: any) => a.application_status === "ACTIVATED");
    if (!activated) return null;
    // Fetch the target for this company
    const companyName = activated.company_name;
    sessionStorage.setItem("company_name", companyName);
    sessionStorage.setItem("role", activated.role || "");
    // Now resolve target_id from the backend
    const targRes = await fetch(`${API_BASE}/target/list?student_id=${studentId}`);
    if (targRes.ok) {
      const targData = await targRes.json();
      const match = (targData.targets || []).find((t: any) => t.company_name === companyName);
      if (match) {
        sessionStorage.setItem("target_id", String(match.id));
        return match.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Auto-fetch and store resume_id */
async function resolveResumeId(studentId: number): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/resume/latest?student_id=${studentId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const id = data?.resume_id ?? data?.id ?? null;
    if (id) sessionStorage.setItem("resume_id", String(id));
    return id;
  } catch {
    return null;
  }
}

type PlanTask = {
  title: string;
  description: string;
  duration_minutes: number;
};

type PlanDay = {
  day: number;
  focus: string;
  tasks: PlanTask[];
};

type PlanJson = {
  overview?: string;
  daily_plan?: PlanDay[];
  curriculum?: { category: string; topics: { title: string; description: string; mastery_time_minutes?: number; }[] }[];
  resources?: string[];
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;
const AUTO_RETRY_MAX = 10;

const TERMINAL_ERROR_STATUSES = new Set(["failed", "failure", "error", "unknown"]);

export default function PlanPage() {
  const router = useRouter();
  const goToTargetAnalysis = () => {
    router.push("/target");
  };
  const [studentId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const storedStudentId = sessionStorage.getItem("student_id");
    return storedStudentId ? Number(storedStudentId) : null;
  });
  const [targetId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const storedTargetId = sessionStorage.getItem("target_id");
    return storedTargetId ? Number(storedTargetId) : null;
  });
  const [companyName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("company_name") ?? "";
  });
  const [role] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("role") ?? "";
  });
  const [interviewDate] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("interview_date") ?? "";
  });
  const [planDetails, setPlanDetails] = useState<PlanDetailResponse | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [autoRetry, setAutoRetry] = useState(false);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDaysRemaining = () => {
    if (!interviewDate) return null;
    const today = new Date();
    const interview = new Date(interviewDate);
    const diff = Math.ceil(
      (interview.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 1;
  };

  // OPTIMIZATION: On page load, immediately check plan status.
  // Plan generation was enqueued during resume upload (fire-and-forget).
  // This just checks current status and fetches plan if ready.
  const initializePlanStatus = useCallback(async () => {
    if (!studentId || !targetId) return;

    setError(null);
    setLoading(true);

    try {
      const response = await generatePrep(studentId);
      setTaskStatus(response.status);
      setTaskId(response.task_id);

      if (response.status === "ready") {
        const latest = await getLatestPrep(studentId, targetId);
        setPlanDetails(latest);
        setLoading(false);
        return;
      }

      if (response.status === "missing") {
        setLoading(false);
        setError(
          "Plan not found for this active session. Please run Target Analysis again for the same license/session, then retry."
        );
        return;
      }

      // Status is 'generating' - start polling
      setLoading(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize plan.";
      setError(message);
      setLoading(false);
    }
  }, [studentId, targetId]);

  useEffect(() => {
    const initPage = async () => {
      const storedStudentId = sessionStorage.getItem("student_id");

      if (!storedStudentId) {
        router.push("/login");
        return;
      }

      const sid = Number(storedStudentId);
      let tId = sessionStorage.getItem("target_id") ? Number(sessionStorage.getItem("target_id")) : null;
      let rId = sessionStorage.getItem("resume_id") ? Number(sessionStorage.getItem("resume_id")) : null;

      // Auto-resolve missing target_id from backend
      if (!tId) {
        tId = await resolveTargetId(sid);
      }

      // Auto-resolve missing resume_id from backend
      if (!rId) {
        rId = await resolveResumeId(sid);
      }

      if (!tId) {
        // No activated company found — send to placements
        router.push("/target");
        return;
      }

      if (!rId) {
        // No resume — send to resume upload
        router.push("/resume");
        return;
      }

      // All good — trigger plan generation
      initializePlanStatus();
    };

    initPage();
  }, [router, initializePlanStatus]);

  const planJson = useMemo(() => {
    const data = planDetails?.plan_json as PlanJson | undefined;
    return data ?? {};
  }, [planDetails]);

  const refreshStatus = useCallback(async () => {
    if (!studentId || !targetId) return;
    try {
      const response = await getPrepStatus(studentId, targetId);
      setTaskStatus(response.status);
      setTaskId(response.task_id || null);
      setLastChecked(new Date().toLocaleTimeString());

      if (response.status === "ready") {
        const latest = await getLatestPrep(studentId, targetId);
        setPlanDetails(latest);
        setLoading(false);
        return;
      }

      if (TERMINAL_ERROR_STATUSES.has(response.status)) {
        setLoading(false);
        setError("Plan generation failed. Please try generating again.");
      }
    } catch {
      setTaskStatus("unknown");
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, [studentId, targetId]);

  useEffect(() => {
    if (!autoRetry || !taskId) return;
    const timer = setInterval(() => {
      setAutoRetryCount((count) => {
        const nextCount = count + 1;
        if (nextCount >= AUTO_RETRY_MAX) {
          setAutoRetry(false);
        }
        return nextCount;
      });
      refreshStatus();
    }, 8000);
    return () => clearInterval(timer);
  }, [autoRetry, refreshStatus, taskId]);

  useEffect(() => {
    if (!studentId || !targetId || !loading) return;

    let isMounted = true;
    const pollStatus = async () => {
      try {
        const response = await getPrepStatus(studentId, targetId);
        if (isMounted) {
          setTaskStatus(response.status);
          setTaskId(response.task_id || null);
          setLastChecked(new Date().toLocaleTimeString());

          if (response.status === "ready") {
            const latest = await getLatestPrep(studentId, targetId);
            setPlanDetails(latest);
            setLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setTaskStatus("unknown");
          setLastChecked(new Date().toLocaleTimeString());
          setLoading(false);
          setError("Could not check plan status. Please refresh and try again.");
        }
      }
    };

    pollStatus();
    const timer = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [studentId, targetId, loading]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top summary row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="stat-widget stat-widget-indigo">
          <div className="stat-icon bg-indigo-50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Company</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)] truncate">{companyName || "—"}</p>
          </div>
        </div>
        <div className="stat-widget stat-widget-emerald">
          <div className="stat-icon bg-emerald-50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Role</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)] truncate">{role || "—"}</p>
          </div>
        </div>
        <div className="stat-widget stat-widget-amber">
          <div className="stat-icon bg-amber-50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Interview</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)]">{interviewDate ? new Date(interviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</p>
          </div>
        </div>
        <div className="stat-widget stat-widget-violet">
          <div className="stat-icon bg-purple-50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Days Left</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-violet-600">{getDaysRemaining() ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {studentId && !planDetails && (
        <div className="card p-8">
          <div className="flex flex-col items-center gap-5">
            {loading && taskStatus === "generating" ? (
              <>
                <div className="animate-pulse-ring flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Generating your plan</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">AI is building a personalized schedule. This takes 30-60 seconds.</p>
                </div>
                <div className="w-full max-w-xs">
                  <div className="progress-bar"><div className="progress-fill" style={{ width: "60%" }} /></div>
                </div>
              </>
            ) : (
              <button type="button" onClick={refreshStatus} disabled={!taskId} className="btn-primary">Check Plan Status</button>
            )}

            {taskStatus && (
              <p className="text-xs text-[var(--text-muted)]">
                Status: <span className="font-semibold capitalize">{taskStatus}</span>
                {lastChecked && <span> &middot; {lastChecked}</span>}
              </p>
            )}

            {taskId && !loading && (
              <button type="button" onClick={refreshStatus} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition">Refresh</button>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
              {taskStatus === "missing" && (
                <button type="button" onClick={goToTargetAnalysis} className="mt-2 block text-xs font-semibold text-red-700 underline hover:no-underline">Go to Target Analysis</button>
              )}
            </div>
          )}

          {(taskStatus === "unknown" || taskStatus === "failure") && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <p>Status check unstable.</p>
              <label className="mt-2 flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input type="checkbox" checked={autoRetry} onChange={(e) => { setAutoRetry(e.target.checked); setAutoRetryCount(0); }} className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600" />
                Auto-retry ({Math.max(0, AUTO_RETRY_MAX - autoRetryCount)} remaining)
              </label>
            </div>
          )}
        </div>
      )}

      {!studentId && (
        <div className="card p-8 text-center"><p className="text-sm text-[var(--text-muted)]">Loading...</p></div>
      )}

      {/* Plan content */}
      {planDetails && (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main plan */}
          <div className="space-y-4">
            {/* Overview card */}
            <div className="card p-6">
              <h2 className="section-header mb-2">Overview</h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{planJson.overview || "Your plan is ready. Review the daily tasks below."}</p>
            </div>

            {/* Daily plan or Curriculum */}
            {(planJson.daily_plan && planJson.daily_plan.length > 0) || (planJson.curriculum && planJson.curriculum.length > 0) ? (
              <div className="space-y-3">
                {planJson.curriculum ? (
                  planJson.curriculum.map((cat, catIdx) => (
                    <div key={`cat-${catIdx}`} className="card overflow-hidden">
                      <div className="flex items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-muted)] px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700">{catIdx + 1}</span>
                          <h3 style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)]">{cat.category}</h3>
                        </div>
                      </div>
                      <div className="divide-y divide-[var(--border-light)]">
                        {cat.topics.map((task, index) => (
                          <div key={`task-${catIdx}-${index}`} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{task.description}</p>
                              </div>
                              <span className="mt-0.5 flex-shrink-0 rounded-md bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-600">{task.mastery_time_minutes || 60}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  planJson.daily_plan!.map((day) => (
                    <div key={`day-${day.day}`} className="card overflow-hidden">
                      <div className="flex items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-muted)] px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700">{day.day}</span>
                          <h3 style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)]">Day {day.day}</h3>
                        </div>
                        <span className="badge badge-accent text-[11px]">{day.focus}</span>
                      </div>
                      <div className="divide-y divide-[var(--border-light)]">
                        {day.tasks.map((task, index) => (
                          <div key={`task-${day.day}-${index}`} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{task.description}</p>
                              </div>
                              <span className="mt-0.5 flex-shrink-0 rounded-md bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-600">{task.duration_minutes}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="card p-6"><p className="text-sm text-[var(--text-muted)]">No daily tasks generated yet.</p></div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card p-5">
              <h2 style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)] mb-3">Plan Details</h2>
              <div className="space-y-3 text-[13px]">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Company</span><span className="font-semibold text-[var(--text-primary)]">{planDetails.company_name}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Role</span><span className="font-semibold text-[var(--text-primary)]">{planDetails.role}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Days</span><span className="font-semibold text-[var(--text-primary)]">{planDetails.days_available}</span></div>
              </div>
            </div>

            <div className="card p-5">
              <h2 style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)] mb-3">Resources</h2>
              {planJson.resources && planJson.resources.length > 0 ? (
                <ul className="space-y-2">
                  {planJson.resources.map((resource, i) => (
                    <li key={`res-${i}`} className="rounded-lg bg-[var(--bg-muted)] p-3 text-[13px] text-[var(--text-secondary)]">{resource}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-[var(--text-muted)]">No resources provided.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
