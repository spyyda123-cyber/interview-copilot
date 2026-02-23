/**
 * ONBOARDING PAGE (/onboarding)
 *
 * Purpose: Collect student profile and learning preferences after license activation.
 *
 * DEPENDENCIES:
 * - Requires: student_id, license_key in sessionStorage (set by /license page)
 * - Protected by: ActivationGuard (redirects to /license if not authenticated)
 * - Backend endpoint: POST /student/create
 *
 * FLOW:
 * 1. User activated license on /license page
 * 2. Redirected to /onboarding with student_id + license_key in session
 * 3. Form loads with optional pre-filled values from sessionStorage (if returning user)
 * 4. User enters:
 *    - Email, name (pre-filled from /license if available)
 *    - Company name, interview date (pre-filled from license response)
 *    - Job role (optional, defaults to "general")
 *    - Primary skill (main technical expertise)
 *    - Known skills (comma-separated list)
 *    - Support mode (guided/self/adaptive learning style)
 *    - Tone (supportive/direct/neutral communication)
 *    - Coding required (include hands-on coding exercises?)
 * 5. Form calls createStudent() API
 * 6. Backend creates StudentProfile record with preferences
 * 7. Frontend stores profile data in sessionStorage
 * 8. Redirects to /target (next: job description analysis)
 *
 * FORM FIELDS MAPPED TO BACKEND:
 * - name → sent to POST /student/create (display name)
 * - email → sent to POST /student/create (contact email)
 * - company_name → fetched from sessionStorage (set by /license)
 * - interview_date → fetched from sessionStorage (set by /license)
 * - role → optional, sent to backend or defaults to company license role
 * - primary_skill → sent to backend (main skill)
 * - known_skills → sent to backend as JSON array (["Python", "SQL", ...])
 * - support_mode → sent to backend (personalization flag)
 * - tone → sent to backend (Gemini language tone)
 * - coding_required → sent to backend as boolean
 *
 * COMPUTED FIELD:
 * - days_remaining: Calculated from interview_date - today
 *   Purpose: Show user how many days they have to prepare
 *
 * SESSION KEYS READ:
 * - student_name, student_email: Pre-fill name/email if user went back/returned
 * - company_name, interview_date: Pre-fill company/date from license
 * - role: Pre-fill if user already selected role
 * - primary_skill, known_skills: Pre-fill from previous session
 * - support_mode, tone, coding_required: Pre-fill preferences
 *
 * SESSION KEYS SET (after form submission):
 * - primary_skill, known_skills, support_mode, tone, coding_required: User prefs
 * - (student_id remains from /license activation)
 * - (license_key remains from /license activation)
 *
 * VALIDATION:
 * - Checks email is not empty (comes from license activation, should always exist)
 * - If missing, tells user to "activate your license again" and return to /license
 * - required fields on all inputs (HTML form validation)
 * - known_skills split by comma on submission
 *
 * ERROR HANDLING:
 * - 404: Student profile not found
 * - 400: Missing required fields
 * - Network timeout: "Please try again"
 * - Display errors in red box at bottom of form
 *
 * WHAT BREAKS IF REMOVED:
 * - Users cannot provide learning preferences
 * - No StudentProfile created, so backend has no personalization data
 * - Plan generation would fail (backend expects StudentProfile)
 * - Gemini has no context about skill level, support mode, tone preference
 *
 * Used by: ActivationGuard (protected route)
 * Previous: /license page (activation)
 * Next: /target page (job description analysis)
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { createStudent } from "@/src/lib/api";

const SUPPORT_OPTIONS = [
  { value: "guided", label: "Guided coaching" },
  { value: "self", label: "Self-driven" },
  { value: "adaptive", label: "Adaptive" },
];

const TONE_OPTIONS = [
  { value: "supportive", label: "Supportive" },
  { value: "direct", label: "Direct" },
  { value: "neutral", label: "Neutral" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [role, setRole] = useState("");
  const [primarySkill, setPrimarySkill] = useState("");
  const [knownSkills, setKnownSkills] = useState("");
  const [supportMode, setSupportMode] = useState(SUPPORT_OPTIONS[0].value);
  const [tone, setTone] = useState(TONE_OPTIONS[0].value);
  const [codingRequired, setCodingRequired] = useState(true);
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
    const storedName = sessionStorage.getItem("student_name");
    const storedEmail = sessionStorage.getItem("student_email");
    const storedCompanyName = sessionStorage.getItem("company_name");
    const storedInterviewDate = sessionStorage.getItem("interview_date");
    const storedRole = sessionStorage.getItem("role");
    const storedPrimarySkill = sessionStorage.getItem("primary_skill");
    const storedKnownSkills = sessionStorage.getItem("known_skills");
    const storedSupport = sessionStorage.getItem("support_mode");
    const storedTone = sessionStorage.getItem("tone");
    const storedCoding = sessionStorage.getItem("coding_required");

    if (storedName) setName(storedName);
    if (storedEmail) setEmail(storedEmail);
    if (storedCompanyName) setCompanyName(storedCompanyName);
    if (storedInterviewDate) setInterviewDate(storedInterviewDate);
    if (storedRole) setRole(storedRole);
    if (storedPrimarySkill) setPrimarySkill(storedPrimarySkill);
    if (storedKnownSkills) setKnownSkills(storedKnownSkills);
    if (storedSupport) setSupportMode(storedSupport);
    if (storedTone) setTone(storedTone);
    if (storedCoding) setCodingRequired(storedCoding === "true");
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("License activation data is missing. Please activate your license again.");
      return;
    }

    const parsedSkills = knownSkills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const response = await createStudent({
        name: name.trim(),
        email: email.trim(),
        primary_skill: primarySkill.trim(),
        known_skills: parsedSkills,
        support_mode: supportMode,
        tone,
        coding_required: codingRequired,
      });

      sessionStorage.setItem("student_id", String(response.student_id));
      sessionStorage.setItem("student_name", name.trim());
      sessionStorage.setItem("student_email", email.trim());
      sessionStorage.setItem("primary_skill", primarySkill.trim());
      sessionStorage.setItem("known_skills", parsedSkills.join(", "));
      sessionStorage.setItem("support_mode", supportMode);
      sessionStorage.setItem("tone", tone);
      sessionStorage.setItem("coding_required", String(codingRequired));

      router.push("/target");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Onboarding failed. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Step 1 of 4 · Personal Info
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
          Tell us about your goals so we can personalize your prep plan.
        </h1>
        <p className="text-base text-slate-600">
          We will use this information to customize the tone, focus areas, and pacing.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Company Name:</span>{" "}
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

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <form className="space-y-6" onSubmit={handleSubmit}>
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

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Primary skill focus
            <input
              value={primarySkill}
              onChange={(event) => setPrimarySkill(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Backend fundamentals"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Known skills (comma separated)
            <input
              value={knownSkills}
              onChange={(event) => setKnownSkills(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Python, SQL, REST APIs"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Support mode
            <select
              value={supportMode}
              onChange={(event) => setSupportMode(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              {SUPPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Preferred tone
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                {TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={codingRequired}
                onChange={(event) => setCodingRequired(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Include coding practice
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner /> Creating your profile...
                </span>
              ) : (
                "Continue to Target Setup →"
              )}
            </button>
            <p className="text-center text-sm text-slate-500">
              We will save your preferences for the rest of the flow.
            </p>
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
