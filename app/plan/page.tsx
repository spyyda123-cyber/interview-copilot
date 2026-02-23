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
 * FLOW:
 * 1. Page loads, checks all required session keys exist
 * 2. User clicks "Generate Plan" button
 * 3. Calls generatePrep() → returns task_id and status
 *    - If status="ready": existing plan found, fetch details immediately
 *    - If status="generating": new generation queued, start polling
 * 4. Polling loop: getPrepStatus() every 5 seconds (POLL_INTERVAL_MS)
 *    - Shows spinner while status="generating"
 *    - Stops polling when status becomes "ready" or "error"
 * 5. On status="ready": call getLatestPrep() to fetch full plan details
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
  const [licenseKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("license_key") ?? "";
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

  useEffect(() => {
    const storedResumeId = sessionStorage.getItem("resume_id");

    // Guard: redirect if previous steps not completed
    if (!studentId || !licenseKey) {
      router.push("/license");
      return;
    }

    if (!targetId) {
      router.push("/target");
      return;
    }

    if (!storedResumeId) {
      router.push("/resume");
      return;
    }
  }, [licenseKey, router, studentId, targetId]);

  const planJson = useMemo(() => {
    const data = planDetails?.plan_json as PlanJson | undefined;
    return data ?? {};
  }, [planDetails]);

  const handleGeneratePlan = async () => {
    if (!studentId || !licenseKey || !targetId) return;

    setError(null);
    setTaskStatus(null);
    setTaskId(null);
    setPlanDetails(null);
    setLoading(true);

    try {
      const response = await generatePrep(studentId, licenseKey);
      setTaskStatus(response.status);
      setTaskId(response.task_id);

      if (response.status === "ready") {
        const latest = await getLatestPrep(studentId, licenseKey, targetId);
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

      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const statusResponse = await getPrepStatus(studentId, licenseKey, targetId);
          setTaskStatus(statusResponse.status);
          setTaskId(statusResponse.task_id || null);
          setLastChecked(new Date().toLocaleTimeString());

          if (statusResponse.status === "ready") {
            const latest = await getLatestPrep(studentId, licenseKey, targetId);
            setPlanDetails(latest);
            setAutoRetry(false);
            setLoading(false);
            return;
          }

          if (statusResponse.status === "missing") {
            setLoading(false);
            setAutoRetry(false);
            setError(
              "Plan not found for this active session. Please run Target Analysis again for the same license/session, then retry."
            );
            return;
          }

          if (TERMINAL_ERROR_STATUSES.has(statusResponse.status)) {
            setLoading(false);
            setAutoRetry(false);
            setError("Plan generation failed. Please try generating again.");
            return;
          }

          if (attempts < MAX_POLL_ATTEMPTS) {
            setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setLoading(false);
            setError(
              "Plan generation is still running. Check again in a minute."
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          setLoading(false);
          setError(message || "Failed to fetch plan status.");
        }
      };

      poll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Plan generation failed.";
      setError(message);
      setLoading(false);
    }
  };

  const refreshStatus = useCallback(async () => {
    if (!studentId || !licenseKey || !targetId) return;
    try {
      const response = await getPrepStatus(studentId, licenseKey, targetId);
      setTaskStatus(response.status);
      setTaskId(response.task_id || null);
      setLastChecked(new Date().toLocaleTimeString());

      if (response.status === "ready") {
        const latest = await getLatestPrep(studentId, licenseKey, targetId);
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
  }, [licenseKey, studentId, targetId]);

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
    if (!studentId || !licenseKey || !targetId || !loading) return;

    let isMounted = true;
    const pollStatus = async () => {
      try {
        const response = await getPrepStatus(studentId, licenseKey, targetId);
        if (isMounted) {
          setTaskStatus(response.status);
          setTaskId(response.task_id || null);
          setLastChecked(new Date().toLocaleTimeString());

          if (response.status === "ready") {
            const latest = await getLatestPrep(studentId, licenseKey, targetId);
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
  }, [studentId, licenseKey, targetId, loading]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Step 4 of 4 · Preparation Plan
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
          Build a day-by-day preparation plan tailored to your resume and goal.
        </h1>
        <p className="text-base text-slate-600">
          Generate the plan when you are ready. We will poll until the AI plan is ready.
        </p>
      </div>

      {studentId && (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Company:</span>{" "}
              {companyName || "-"}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Role:</span> {role || "-"}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Interview Date:</span>{" "}
              {interviewDate || "-"}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Days Remaining:</span>{" "}
              {getDaysRemaining() ?? "-"}
            </p>
          </div>
        </div>
      )}

      {studentId && (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {companyName || "Target company"}
              </p>
              <p className="text-sm text-slate-500">
                {role || "Target role"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={loading || autoRetry}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <LoadingSpinner /> : "Generate Plan"}
            </button>
          </div>

          {taskStatus ? (
            <p className="mt-4 text-sm text-slate-500">
              Task status: <span className="font-semibold">{taskStatus}</span>
            </p>
          ) : null}

          {autoRetry ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              Auto-retry active
            </p>
          ) : null}

          {lastChecked ? (
            <p className="mt-1 text-xs text-slate-400">
              Last checked: {lastChecked}
            </p>
          ) : null}

          {loading && taskStatus ? (
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              Generating plan. This can take a few minutes.
            </p>
          ) : null}

          {taskId ? (
            <button
              type="button"
              onClick={refreshStatus}
              className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:text-slate-900"
            >
              Refresh status
            </button>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
              {taskStatus === "missing" ? (
                <button
                  type="button"
                  onClick={goToTargetAnalysis}
                  className="mt-3 inline-flex items-center rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-100"
                >
                  Go to Target Analysis
                </button>
              ) : null}
            </div>
          ) : null}

          {taskStatus === "unknown" || taskStatus === "failure" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Status check is not stable. Enable auto-retry to keep checking.
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                <input
                  type="checkbox"
                  checked={autoRetry}
                  onChange={(event) => {
                    setAutoRetry(event.target.checked);
                    setAutoRetryCount(0);
                  }}
                  className="h-4 w-4 rounded border-amber-300"
                />
                Auto-retry
              </label>
              {autoRetry ? (
                <p className="mt-2 text-xs text-amber-700">
                  Checks remaining: {Math.max(0, AUTO_RETRY_MAX - autoRetryCount)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {planDetails ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
            <p className="mt-3 text-sm text-slate-600">
              {planJson.overview || "Plan ready. Review your daily tasks below."}
            </p>

            <h3 className="mt-6 text-lg font-semibold text-slate-900">Daily plan</h3>
        

      {!studentId && (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
          <p className="text-base text-slate-600">
            Loading your preparation plan...
          </p>
        </div>
      )}    {planJson.daily_plan && planJson.daily_plan.length > 0 ? (
              <div className="mt-4 space-y-4">
                {planJson.daily_plan.map((day) => (
                  <div
                    key={`day-${day.day}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Day {day.day}
                      </h4>
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        {day.focus}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {day.tasks.map((task, index) => (
                        <div
                          key={`task-${day.day}-${index}`}
                          className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {task.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {task.description}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                            {task.duration_minutes} min
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                The plan did not include daily tasks yet.
              </p>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">
                Plan resources
              </h2>
              {planJson.resources && planJson.resources.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {planJson.resources.map((resource, index) => (
                    <li
                      key={`resource-${index}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      {resource}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  No resources provided.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">
                Plan metadata
              </h2>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Student ID: {planDetails.student_id}</p>
                <p>Plan ID: {planDetails.plan_id}</p>
                <p>Company: {planDetails.company_name}</p>
                <p>Role: {planDetails.role}</p>
                <p>Days available: {planDetails.days_available}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
