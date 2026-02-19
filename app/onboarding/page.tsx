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
  const [primarySkill, setPrimarySkill] = useState("");
  const [knownSkills, setKnownSkills] = useState("");
  const [timeLeftDays, setTimeLeftDays] = useState("10");
  const [supportMode, setSupportMode] = useState(SUPPORT_OPTIONS[0].value);
  const [tone, setTone] = useState(TONE_OPTIONS[0].value);
  const [codingRequired, setCodingRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedName = sessionStorage.getItem("student_name");
    const storedEmail = sessionStorage.getItem("student_email");
    const storedPrimarySkill = sessionStorage.getItem("primary_skill");
    const storedKnownSkills = sessionStorage.getItem("known_skills");
    const storedTime = sessionStorage.getItem("time_left_days");
    const storedSupport = sessionStorage.getItem("support_mode");
    const storedTone = sessionStorage.getItem("tone");
    const storedCoding = sessionStorage.getItem("coding_required");

    if (storedName) setName(storedName);
    if (storedEmail) setEmail(storedEmail);
    if (storedPrimarySkill) setPrimarySkill(storedPrimarySkill);
    if (storedKnownSkills) setKnownSkills(storedKnownSkills);
    if (storedTime) setTimeLeftDays(storedTime);
    if (storedSupport) setSupportMode(storedSupport);
    if (storedTone) setTone(storedTone);
    if (storedCoding) setCodingRequired(storedCoding === "true");
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

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
        time_left_days: Number(timeLeftDays),
        support_mode: supportMode,
        tone,
        coding_required: codingRequired,
      });

      sessionStorage.setItem("student_id", String(response.student_id));
      sessionStorage.setItem("student_name", name.trim());
      sessionStorage.setItem("student_email", email.trim());
      sessionStorage.setItem("primary_skill", primarySkill.trim());
      sessionStorage.setItem("known_skills", parsedSkills.join(", "));
      sessionStorage.setItem("time_left_days", String(timeLeftDays));
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
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Days left to prepare
              <input
                type="number"
                min={1}
                value={timeLeftDays}
                onChange={(event) => setTimeLeftDays(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
          </div>

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
