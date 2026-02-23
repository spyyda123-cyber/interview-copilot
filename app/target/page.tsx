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
