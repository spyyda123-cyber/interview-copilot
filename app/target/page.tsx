/**
 * TARGET INTERVIEW PAGE (/target)
 *
 * Purpose: Collect job description for analysis - extract required skills, difficulty, and interview format.
 *
 * DEPENDENCIES:
 * - Requires: student_id, license_key, company_name, interview_date in sessionStorage
 * - Protected by: ActivationGuard
 * - Backend endpoints: POST /target/analyze, GET /target/status
 *
 * FLOW:
 * 1. User arrives from /onboarding
 * 2. Form pre-filled with company_name + role from license/session
 * 3. User pastes job description (JD) into textarea
 * 4. Form calls analyzeTarget() API
 * 5. Backend enqueues analyze_target_task (Celery worker)
 * 6. Response includes target_id
 * 7. Frontend polls getTargetStatus(target_id) every 4 seconds (POLL_INTERVAL_MS)
 * 8. Once status="done", analysis results appear (required_skills, difficulty, round_structure)
 * 9. User clicks "Continue to Plan" → redirects to /prep
 *
 * FORM FIELDS:
 * - company_name: Pre-filled from /license (read-only in some versions, locked)
 *   Purpose: Ensure user analyzes JD for correct company
 *   Validation: Must not be empty, backend validates matches license company
 * - role: Optional job title (e.g., "Backend Engineer", "Senior Python Developer")
 *   Pre-filled from license if available
 *   Used: Passed to analyzeTarget for role-specific context
 * - jd_text: Full job description text (user copy-pastes from job posting)
 *   Persisted: Stored in sessionStorage for reference
 *   Used: Sent to Gemini for skill extraction and format analysis
 *
 * ASYNC ANALYSIS BEHAVIOR:
 * - analyzeTarget() returns immediately with target_id (doesn't wait)
 * - Status cycle: submit → status="processing" → wait for analysis
 * - Polling: Every 4 seconds check if analysis complete
 * - During polling: Show spinner, disable form, show "Analyzing..." message
 * - Completion: status becomes "done", results displayed, button changes to "Continue"
 * - Failure: status becomes "error" after ~10 min or worker crash
 *
 * ANALYSIS RESULTS (once status="done"):
 * - required_skills: Array of skills extracted from JD (e.g., ["Python", "REST APIs", "PostgreSQL"])
 *   Purpose: Used by resume gap analysis, influences learning plan
 * - difficulty: Level assessment (e.g., "mid-level", "senior")
 *   Purpose: Affects task density and complexity in learning plan
 * - round_structure: Interview format description (e.g., "phone screen + 2 coding rounds + behavioral")
 *   Purpose: Informs learning plan focus areas
 *
 * ERROR HANDLING:
 * - 403: License invalid → redirected to /license (by api.ts clearSessionAndRedirectToLicense)
 * - 404: Student not found, target JD too short
 * - Timeout after 10 minutes: status="error", show "Analysis failed, please retry"
 * - Network error: "Request timed out, please try again"
 * - User retry: startAnalysis() called again, new target_id generated
 *
 * SESSION KEYS:
 * READ: student_id, license_key, company_name, role (from /license activation)
 * WRITE: target_id (for /prep to reference), jd_text (for reference)
 *
 * WHAT BREAKS IF REMOVED:
 * - No job description analysis
 * - No required_skills extraction (plan would be generic)
 * - No difficulty/round_structure info (plan can't tailor to interview format)
 * - Resume gap analysis can't compare against actual JD requirements
 * - Plan would be far less valuable
 *
 * POLLING PATTERN:
 * - useEffect watches status state
 * - When status="processing" and targetId exists, polling effect runs
 * - Uses setTimeout for non-blocked polling (continues while user navigates)
 * - Stops polling when status changes to "done" or "error"
 * - Manual retry via "Retry Analysis" button: calls startAnalysis() again
 *
 * Used by: ActivationGuard (protected route)
 * Previous: /onboarding (student profile)
 * Next: /prep (learning plan generation, uses target_id)
 */
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  analyzeTarget,
  getTargetStatus,
} from "@/src/lib/api";

const POLL_INTERVAL_MS = 4000;
type AnalysisState = "idle" | "processing" | "ready" | "failed";

export default function TargetPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [status, setStatus] = useState<AnalysisState>("idle");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("");
  const [roundStructure, setRoundStructure] = useState("");

  useEffect(() => {
    const storedStudentId = sessionStorage.getItem("student_id");
    const storedLicenseKey = sessionStorage.getItem("license_key");

    // Guard: redirect if no student_id (Step 1 not completed)
    if (!storedStudentId || !storedLicenseKey) {
      router.push("/license");
      return;
    }

    const storedCompanyName = sessionStorage.getItem("company_name");
    const storedRole = sessionStorage.getItem("role");
    const storedJd = sessionStorage.getItem("jd_text");

    setStudentId(Number(storedStudentId));
    setLicenseKey(storedLicenseKey);
    if (storedCompanyName) setCompanyName(storedCompanyName);
    if (storedRole) setRole(storedRole);
    if (storedJd) setJdText(storedJd);

    const storedTargetId = sessionStorage.getItem("target_id");
    if (storedTargetId) {
      const parsed = Number(storedTargetId);
      if (Number.isFinite(parsed) && parsed > 0) {
        setTargetId(parsed);
        setStatus("processing");
      }
    }
  }, [router]);

  const startAnalysis = async () => {
    if (!studentId || !licenseKey || !companyName.trim() || !jdText.trim()) return;
    if (targetId && status === "processing") return;

    setSubmitting(true);
    setError(null);
    setRequiredSkills([]);
    setDifficulty("");
    setRoundStructure("");

    try {
      const response = await analyzeTarget({
        license_key: licenseKey,
        student_id: studentId,
        company_name: companyName.trim(),
        role: role.trim() || null,
        jd_text: jdText.trim(),
      });

      sessionStorage.setItem("company_name", companyName.trim());
      sessionStorage.setItem("role", role.trim());
      sessionStorage.setItem("jd_text", jdText.trim());
      sessionStorage.setItem("target_id", String(response.target_id));

      setTargetId(response.target_id);
      setStatus(response.status === "failed" ? "failed" : "processing");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Target analysis failed.";
      setError(message);
      setStatus("failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await startAnalysis();
  };

  const handleRetry = async () => {
    sessionStorage.removeItem("target_id");
    setTargetId(null);
    setStatus("idle");
    setError(null);
    await startAnalysis();
  };

  useEffect(() => {
    if (!targetId || status !== "processing") return;

    let active = true;

    const poll = async () => {
      try {
        const statusResponse = await getTargetStatus(targetId);
        if (!active) return;

        if (statusResponse.status === "ready") {
          setStatus("ready");
          setError(null);
          setRequiredSkills(statusResponse.required_skills ?? []);
          setDifficulty(statusResponse.difficulty ?? "");
          setRoundStructure(statusResponse.round_structure ?? "");
          return;
        }

        if (statusResponse.status === "failed") {
          setError(statusResponse.error || "Target analysis failed.");
          setStatus("failed");
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to fetch target status.";
        if (message.toLowerCase() === "not found") {
          setError("Backend is missing /target/status. Restart API on latest backend code.");
        } else {
          setError(message);
        }
        setStatus("failed");
      }
    };

    poll();
    return () => {
      active = false;
    };
  }, [targetId, status]);

  const isProcessing = status === "processing";
  const isReady = status === "ready";
  const isFailed = status === "failed";

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Step 2 of 4 · Target Company
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
          Share the role and job description you are preparing for.
        </h1>
        <p className="text-base text-slate-600">
          We will extract key skills and align the preparation plan with the company expectations.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Company name
            <input
              value={companyName}
              readOnly
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 shadow-sm outline-none"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Role
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Backend Developer"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Job description
            <textarea
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              required
              rows={8}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Paste the job description here."
            />
          </label>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={submitting || isProcessing || isReady}
              className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting || isProcessing ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner /> Analyzing job description...
                </span>
              ) : (
                "Analyze Target Company"
              )}
            </button>
            <p className="text-center text-sm text-slate-500">
              We will save the target context for resume analysis.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {targetId ? (
            <div className="space-y-4">
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  isFailed
                    ? "border border-rose-200 bg-rose-50 text-rose-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {isReady ? <p className="font-semibold">Target analysis complete!</p> : null}
                {isProcessing ? <p className="font-semibold">Analyzing job description...</p> : null}
                {isFailed ? <p className="font-semibold">Target analysis failed.</p> : null}
              </div>

              {isReady ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <div>
                    <p className="font-semibold text-slate-900">Extracted skills</p>
                    {requiredSkills.length > 0 ? (
                      <p className="mt-1">{requiredSkills.join(", ")}</p>
                    ) : (
                      <p className="mt-1 text-slate-500">No skills extracted.</p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Interview topics</p>
                    <p className="mt-1">{roundStructure || "Not available"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Difficulty</p>
                    <p className="mt-1">{difficulty || "Unknown"}</p>
                  </div>
                </div>
              ) : null}

              {isReady ? (
                <button
                  type="button"
                  onClick={() => router.push("/resume")}
                  className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
                >
                  Continue to Resume Upload
                </button>
              ) : null}

              {isFailed ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={submitting}
                  className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
