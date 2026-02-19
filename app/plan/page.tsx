"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  generatePrep,
  getLatestPrep,
  getPlanStatus,
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

export default function PlanPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [daysAvailable, setDaysAvailable] = useState<number | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetailResponse | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [autoRetry, setAutoRetry] = useState(false);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedStudentId = sessionStorage.getItem("student_id");
    const storedResumeId = sessionStorage.getItem("resume_id");

    // Guard: redirect if previous steps not completed
    if (!storedStudentId) {
      router.push("/onboarding");
      return;
    }

    if (!storedResumeId) {
      router.push("/resume");
      return;
    }

    const storedCompanyName = sessionStorage.getItem("company_name");
    const storedRole = sessionStorage.getItem("role");
    const storedDays = sessionStorage.getItem("time_left_days");

    setStudentId(Number(storedStudentId));
    if (storedCompanyName) {
      setCompanyName(storedCompanyName);
    }
    if (storedRole) {
      setRole(storedRole);
    }
    if (storedDays) {
      setDaysAvailable(Number(storedDays));
    }
  }, [router]);

  const planJson = useMemo(() => {
    const data = planDetails?.plan_json as PlanJson | undefined;
    return data ?? {};
  }, [planDetails]);

  const handleGeneratePlan = async () => {
    if (!studentId) return;

    setError(null);
    setTaskStatus(null);
    setTaskId(null);
    setPlanDetails(null);
    setLoading(true);

    try {
      const response = await generatePrep(studentId);
      setTaskStatus(response.status);
      setTaskId(response.task_id);

      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const statusResponse = await getPlanStatus(response.task_id);
          setTaskStatus(statusResponse.status);
          setLastChecked(new Date().toLocaleTimeString());

          if (statusResponse.status === "success") {
            const latest = await getLatestPrep(studentId);
            setPlanDetails(latest);
            setAutoRetry(false);
            setLoading(false);
            return;
          }

          if (statusResponse.status === "failure") {
            setLoading(false);
            setAutoRetry(false);
            setError("Plan generation failed. Please try again.");
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

  const refreshStatus = async () => {
    if (!taskId) return;
    try {
      const response = await getPlanStatus(taskId);
      setTaskStatus(response.status);
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setTaskStatus("unknown");
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

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
  }, [autoRetry, taskId]);

  useEffect(() => {
    if (!taskId || !loading) return;

    let isMounted = true;
    const pollStatus = async () => {
      try {
        const response = await getPlanStatus(taskId);
        if (isMounted) {
          setTaskStatus(response.status);
          setLastChecked(new Date().toLocaleTimeString());
        }
      } catch {
        if (isMounted) {
          setTaskStatus("unknown");
          setLastChecked(new Date().toLocaleTimeString());
        }
      }
    };

    pollStatus();
    const timer = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [taskId, loading]);

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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {companyName || "Target company"}
              </p>
              <p className="text-sm text-slate-500">
                {role || "Target role"}
                {daysAvailable ? ` · ${daysAvailable} days` : ""}
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
