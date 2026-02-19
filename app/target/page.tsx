"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../components/LoadingSpinner";
import { analyzeTarget, type TargetAnalyzeResponse } from "@/src/lib/api";

export default function TargetPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TargetAnalyzeResponse | null>(null);

  useEffect(() => {
    const storedStudentId = sessionStorage.getItem("student_id");
    
    // Guard: redirect if no student_id (Step 1 not completed)
    if (!storedStudentId) {
      router.push("/onboarding");
      return;
    }

    const storedCompanyName = sessionStorage.getItem("company_name");
    const storedRole = sessionStorage.getItem("role");
    const storedJd = sessionStorage.getItem("jd_text");

    setStudentId(Number(storedStudentId));
    if (storedCompanyName) setCompanyName(storedCompanyName);
    if (storedRole) setRole(storedRole);
    if (storedJd) setJdText(storedJd);
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setAnalysis(null);

    if (!studentId) return;

    setLoading(true);
    try {
      const response = await analyzeTarget({
        student_id: studentId,
        company_name: companyName.trim(),
        role: role.trim() || null,
        jd_text: jdText.trim(),
      });

      sessionStorage.setItem("company_name", companyName.trim());
      sessionStorage.setItem("role", role.trim());
      sessionStorage.setItem("jd_text", jdText.trim());
      sessionStorage.setItem("target_id", String(response.target_id));
      setAnalysis(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Target analysis failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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
              onChange={(event) => setCompanyName(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Stripe"
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
              disabled={loading || !!analysis}
              className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner /> Analyzing target...
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

          {analysis ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <p className="font-semibold">Target analysis complete!</p>
                <p className="mt-2 text-sm text-emerald-800 whitespace-pre-line">
                  {analysis.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/resume")}
                className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
              >
                Continue to Resume Upload →
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
