/**
 * NAVBAR COMPONENT
 *
 * Displays header with app branding, API health status, and session reset button.
 *
 * STRUCTURE:
 * - Left: App title "Interview Prep Studio"
 * - Center: Real-time API health indicator (ok | down | checking)
 * - Right: "Reset Session" button for manual logout
 *
 * HEALTH CHECK:
 * - Calls /health endpoint every 15 seconds
 * - Shows green (ok), red (down), or gray (checking) status badge
 * - Used to detect backend connectivity issues
 * - Not auth-dependent (GET /health is public)
 *
 * RESET BUTTON:
 * - Clears ALL session storage keys (see SESSION_KEYS_TO_CLEAR)
 * - Redirects to /license page
 * - User must re-activate license to continue
 *
 * WHEN RENDERED:
 * - Only visible when ActivationGuard detects student_id + license_key in session
 * - Hidden during initial load and on /license page (non-activated users)
 * - Disappears immediately after Reset Button click (before redirect completes)
 *
 * SESSION KEYS CLEARED:
 * - student_id, license_key, company_name, interview_date (core activation)
 * - target_id, resume_id (state from current prep session)
 * - primary_skill, known_skills, support_mode, tone, coding_required (profile data)
 * - See app/docs/session-contract.ts for detailed key explanations
 *
 * Used by: ActivationGuard (conditionally renders when user is activated)
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getHealth } from "@/src/lib/api";

export default function NavBar() {
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<"ok" | "down" | "checking">(
    "checking"
  );

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const response = await getHealth();
        if (isMounted) {
          setApiStatus(response.status === "ok" ? "ok" : "down");
        }
      } catch {
        if (isMounted) {
          setApiStatus("down");
        }
      }
    };

    checkHealth();
    const timer = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const statusStyles =
    apiStatus === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : apiStatus === "down"
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : "border-slate-200 bg-slate-50 text-slate-500";

  const handleResetSession = () => {
    /**
     * Clear all session data and redirect to license page.
     * This is the equivalent of "logout" - user must re-activate to continue.
     */
    const keysToClear = [
      "student_id",
      "student_name",
      "student_email",
      "license_key",
      "company_name",
      "interview_date",
      "role",
      "target_id",
      "resume_id",
      "primary_skill",
      "known_skills",
      "support_mode",
      "tone",
      "coding_required",
      "jd_text",
    ];

    keysToClear.forEach((key) => sessionStorage.removeItem(key));
    router.replace("/license");
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Interview Prep Studio
        </p>
        <p className="text-lg font-semibold text-slate-900">
          AI Interview Preparation
        </p>
      </div>
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles}`}
      >
        API {apiStatus === "checking" ? "Checking" : apiStatus}
      </span>
      <button
        type="button"
        onClick={handleResetSession}
        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-50"
      >
        Reset Session
      </button>
    </header>
  );
}
