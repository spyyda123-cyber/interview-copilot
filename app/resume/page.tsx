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
  const [licenseKey, setLicenseKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeUploadResponse | null>(null);

  useEffect(() => {
    const storedStudentId = sessionStorage.getItem("student_id");
    const storedLicenseKey = sessionStorage.getItem("license_key");
    const storedTargetId = sessionStorage.getItem("target_id");

    // Guard: redirect if previous steps not completed
    if (!storedStudentId || !storedLicenseKey) {
      router.push("/license");
      return;
    }
    
    if (!storedTargetId) {
      router.push("/target");
      return;
    }

    setStudentId(Number(storedStudentId));
    setLicenseKey(storedLicenseKey);
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!studentId || !licenseKey) return;

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
        licenseKey,
      });
      sessionStorage.setItem("resume_id", String(response.resume_id));
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
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Step 3 of 4 · Resume Upload
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
          Upload your resume to identify gaps against the job description.
        </h1>
        <p className="text-base text-slate-600">
          We will analyze your resume and share ATS alignment plus missing skills.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Resume (PDF only)
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading || !!result}
              className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner /> Analyzing resume...
                </span>
              ) : (
                "Upload and Analyze Resume"
              )}
            </button>
            <p className="text-center text-sm text-slate-500">
              PDF files only, up to your backend limit.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-700">Resume analyzed successfully!</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-800">ATS Score:</span>
                    <span className="text-lg font-bold text-emerald-900">{result.ats_score}%</span>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
                      Missing Skills
                    </p>
                    <p className="mt-1 text-sm text-emerald-900">
                      {result.missing_skills.length > 0
                        ? result.missing_skills.join(", ")
                        : "None detected - excellent match!"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/prep")}
                className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
              >
                Continue to Preparation Plan →
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
