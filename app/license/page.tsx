/**
 * LICENSE ACTIVATION PAGE (/license)
 *
 * Purpose: First step in user onboarding - activate license key to gain access to the system.
 *
 * FLOW:
 * 1. User visits app, redirected here by ActivationGuard (if no student_id + license_key)
 * 2. User enters: email, name, license_key
 * 3. Form calls activateLicense() API
 * 4. Backend validates license_key against PrepLicense model
 * 5. Backend returns: student_id, company_name, interview_date
 * 6. Frontend stores these in sessionStorage
 * 7. ActivationGuard detects change, redirects to /onboarding
 *
 * FORM FIELDS:
 * - email: User contact email (passed to backend for student creation)
 * - name: User full name (passed to backend, displayed in UI)
 * - license_key: Unique activation code (e.g., "GOOGLE-2026-ABC123")
 *   Format set by backend admin at license generation time
 *
 * BACKEND VALIDATION (POST /license/activate):
 * - Validates license_key exists in PrepLicense table
 * - Validates license is marked status="unused" (not already activated)
 * - Validates interview_date is in future (auto-expires if past)
 * - Returns student_id (may be NULL if first-time activation)
 * - Returns company_name (required, set when license created)
 * - Returns interview_date (required, set when license created)
 *
 * SESSION STORAGE ON SUCCESS:
 * Sets these keys for protected pages to access:
 * - student_id: Backend student record ID
 * - license_key: What user entered (used for auth on all protected API calls)
 * - student_name: Echoes input name
 * - student_email: Echoes input email
 * - company_name: From license (read-only, interview company)
 * - interview_date: From license (read-only, interview date)
 * - role: Optional, from license (job title)
 *
 * ERROR HANDLING:
 * - Invalid license_key (404) → "License key not found"
 * - License already activated (409) → "License already in use"
 * - License expired (410) → "License has expired"
 * - Missing email or name (400) → "Please fill in all fields"
 * - Network timeout → "Request timed out, please try again"
 *
 * EARLY EXIT OPTIMIZATION:
 * - useEffect checks if already activated (student_id + license_key in session)
 * - If yes, redirects immediately to /onboarding (skip form entirely)
 * - If student_id exists but license_key missing (stale session), clears it
 *
 * WHAT BREAKS IF REMOVED:
 * - No way for users to activate licenses
 * - No session initialization with student_id + license_key
 * - ActivationGuard can't detect activated users
 * - Protected routes would always redirect to /license
 *
 * Used by: ActivationGuard (redirects unauthenticated users here)
 * Next: After activation → /onboarding page
 * Public: This page is public (no auth required)
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { activateLicense } from "@/src/lib/api";

export default function LicensePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const studentId = sessionStorage.getItem("student_id");
    const licenseKey = sessionStorage.getItem("license_key");
    if (studentId && licenseKey) {
      router.replace("/onboarding");
      return;
    }

    if (studentId && !licenseKey) {
      const keysToClear = [
        "student_id",
        "company_name",
        "interview_date",
        "role",
        "target_id",
        "resume_id",
      ];
      keysToClear.forEach((key) => sessionStorage.removeItem(key));
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await activateLicense({
        name: name.trim(),
        email: email.trim(),
        license_key: licenseKey.trim(),
      });

      sessionStorage.setItem("student_id", String(response.student_id));
      sessionStorage.setItem("student_name", name.trim());
      sessionStorage.setItem("student_email", email.trim());
      sessionStorage.setItem("license_key", licenseKey.trim());
      sessionStorage.setItem("company_name", response.company_name);
      sessionStorage.setItem("interview_date", response.interview_date);

      if (response.role) {
        sessionStorage.setItem("role", response.role);
      }

      router.push("/onboarding");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "License activation failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          License Activation
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
          Activate your access to start interview preparation.
        </h1>
        <p className="text-base text-slate-600">
          Enter your details and license key to continue.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="alex@email.com"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Alex Morgan"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            License key
            <input
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="GOOGLE-2026-ABCD1234"
            />
          </label>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner /> Activating...
                </span>
              ) : (
                "Activate"
              )}
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}