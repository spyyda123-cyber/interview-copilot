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

  const handleResetSession = () => {
    /**
     * Clear all session data and redirect to license page.
     * This is the equivalent of "logout" - user must re-activate to continue.
     */
    const keysToClear = [
      "student_id",
      "student_name",
      "student_email",
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
    router.replace("/login");
  };

  return (
    <header className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Interview Copilot</p>
          <p className="text-[11px] text-[var(--text-muted)] tracking-wide">Prep Studio</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`badge ${
            apiStatus === "ok"
              ? "badge-success"
              : apiStatus === "down"
              ? "badge-danger"
              : "badge-neutral"
          }`}
        >
          <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
            apiStatus === "ok" ? "bg-emerald-500" : apiStatus === "down" ? "bg-red-500" : "bg-slate-400"
          }`} />
          {apiStatus === "checking" ? "Checking" : apiStatus === "ok" ? "Connected" : "Offline"}
        </span>
        <button
          type="button"
          onClick={handleResetSession}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-slate-100 hover:text-[var(--text-primary)]"
        >
          Reset Session
        </button>
      </div>
    </header>
  );
}
