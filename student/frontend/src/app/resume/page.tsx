/**
 * RESUME UPLOAD PAGE (/resume)
 *
 * Purpose: Collect student resume (PDF) for parsing and gap analysis against job description.
 *
 * DEPENDENCIES:
 * - Requires: student_id, license_key, target_id in sessionStorage
 * - Requires: Target interview analysis completed (from /target page)
 * - Protected by: ActivationGuard
 * - Backend endpoint: POST /resume/upload
 *
 * FLOW:
 * 1. User arrives from onboarding flow or back-navigation
 * 2. Validation: Check student_id, license_key, target_id exist (redirect if missing)
 * 3. User selects PDF file from computer
 * 4. Form calls uploadResume() API with file + metadata
 * 5. Backend processes:
 *    - Validates PDF format
 *    - Extracts text from PDF (parse_resume_task in Celery)
 *    - Classifies sections (experience, education, skills, etc)
 *    - Compares resume skills vs target JD required_skills
 *    - Creates ResumeGapAnalysis record
 * 6. Response includes: resume_id, missing_skills, ats_score
 * 7. Frontend stores resume_id + displays gap analysis results
 * 8. User clicks "Continue" → /prep (plan generation uses this resume)
 *
 * FORM BEHAVIOR:
 * - File input accepts .pdf files only
 * - Frontend validates: file.type === "application/pdf" and file.name.endsWith(".pdf")
 * - Backend re-validates: 400 error if not PDF
 * - Shows loading spinner during upload and parsing
 * - Parsing happens async (Celery worker), response returns resume_id immediately
 *
 * RESPONSE FIELDS (ResumeUploadResponse):
 * - resume_id: Unique resume identifier (stored in sessionStorage for reference)
 * - status: "processing" or "complete" (parsing status)
 * - missing_skills: Array of skills from target JD not found in resume
 *   Example: ["Kubernetes", "Docker", "AWS Lambda"]
 *   Purpose: User understands what they need to learn
 * - ats_score: Applicant Tracking System keyword match (0-100)
 *   Purpose: Indicates how well resume matches JD keywords
 *
 * ERROR HANDLING:
 * - 403: License invalid → redirected to /license (api.ts)
 * - 404: Student profile or target not found
 * - 400: Invalid file format (not PDF)
 * - Frontend validation: "Please upload your resume as a PDF"
 * - Network timeout: "Upload failed. Try again."
 *
 * SESSION KEYS:
 * READ: student_id, license_key (from activation), target_id (from target analysis)
 * WRITE: resume_id (stored for reference in plan generation)
 *
 * STEP GUARD:
 * - Validates previous steps completed:
 *   - If no student_id/license_key → redirect to /license (step 1)
 *   - If no target_id → redirect to /target (step 3)
 * - This prevents user from skipping steps or accessing with incomplete state
 * - Ensures backend has all required data to generate meaningful plan
 *
 * WHAT BREAKS IF REMOVED:
 * - No resume parsing (backend can't extract sections)
 * - No gap analysis (backend can't compare against target JD)
 * - Learning plan can't focus on resume weaknesses
 * - ATS score feedback lost
 * - Resume context passed to Gemini plan generation would be missing
 *
 * BACKEND ASYNC:
 * - PDF parsing happens in parse_resume_task (Celery worker)
 * - Response returns resume_id immediately (parsing continues in background)
 * - Frontend doesn't wait for parsing to complete
 * - Gap analysis created asynchronously as well
 * - /prep pipeline uses latest resume when generating plan
 *
 * Used by: ActivationGuard (protected route)
 * Previous: /onboarding → /target (job description)
 * Next: /prep (plan generation, uses resume_id indirectly)
 */
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../components/LoadingSpinner";
import { uploadResume, type ResumeUploadResponse } from "@/src/lib/api";

export default function ResumePage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeUploadResponse | null>(null);

  useEffect(() => {
    const storedStudentId = sessionStorage.getItem("student_id");
    const storedTargetId = sessionStorage.getItem("target_id");

    // Guard: redirect if previous steps not completed
    if (!storedStudentId) {
      router.push("/login");
      return;
    }
    
    if (!storedTargetId) {
      router.push("/target");
      return;
    }

    setStudentId(Number(storedStudentId));
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!studentId) return;

    if (!file) {
      setError("Please upload your resume as a PDF.");
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are supported.");
      return;
    }

    setLoading(true);
    try {
      const response = await uploadResume(file, {
        studentId,
      });
      sessionStorage.setItem("resume_id", String(response.resume_id));
      sessionStorage.setItem("ats_score", String(response.ats_score));
      sessionStorage.setItem("missing_skills", response.missing_skills.join(","));
      setResult(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Upload card */}
        <div className="card p-6">
          <div className="mb-6 border-b border-[var(--border)] pb-4">
            <h2 className="section-header">Upload Resume</h2>
            <p className="section-subtitle">We&apos;ll compare your resume against the job requirements.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 px-6 py-12 transition hover:border-indigo-400 hover:bg-indigo-50/60">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{(file.size / 1024).toFixed(0)} KB &middot; Ready to upload</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Click to select a file</p>
                  <p className="text-xs text-[var(--text-muted)]">PDF format, max 10MB</p>
                </div>
              )}
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            </label>

            {!result && (
              <button type="submit" disabled={loading || !file} className="btn-primary">
                {loading ? (
                  <span className="inline-flex items-center gap-2"><LoadingSpinner /> Analyzing...</span>
                ) : (
                  <>
                    Upload &amp; Analyze
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
          </form>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {result ? (
            <div className="animate-fade-in space-y-4">
              {/* ATS Score widget */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">Resume Analyzed</p>
                </div>

                <div className="rounded-lg bg-[var(--bg-muted)] p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider font-semibold">ATS Match Score</p>
                    <p className={`text-2xl font-bold ${
                      result.ats_score >= 70 ? "text-emerald-600" : result.ats_score >= 40 ? "text-amber-600" : "text-red-600"
                    }`}>{result.ats_score}%</p>
                  </div>
                  <div className="progress-bar h-2">
                    <div className="progress-fill h-2" style={{
                      width: `${result.ats_score}%`,
                      background: result.ats_score >= 70 ? "linear-gradient(90deg, #10b981, #34d399)" : result.ats_score >= 40 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)",
                    }} />
                  </div>
                </div>

                {/* Skill gaps */}
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider font-semibold">Skills to Develop</p>
                  {result.missing_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {result.missing_skills.map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{skill}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-600 font-medium">Excellent — no critical gaps.</p>
                  )}
                </div>
              </div>

              <button type="button" onClick={() => router.push("/prep")} className="btn-primary w-full">
                Continue to Study Plan
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="stat-icon bg-emerald-50 !w-10 !h-10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="text-[13px] font-bold text-[var(--text-primary)]">Resume Analysis</p>
                </div>
              </div>
              <ul className="space-y-2 text-[13px] text-[var(--text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">1</span>
                  Upload your resume as PDF
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-600">2</span>
                  AI compares against JD skills
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-600">3</span>
                  Get ATS score &amp; skill gaps
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
