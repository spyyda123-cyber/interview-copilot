"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  getStudentProfile,
  getPlacements,
  getStudentApplications,
  markInterest,
  activateCompany,
  type StudentProfileResponse,
  type CompanyListItem,
  type ApplicationItem,
} from "@/src/lib/api";
import LoadingSpinner from "../components/LoadingSpinner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchLatestResumeId(studentId: number): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/resume/latest?student_id=${studentId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.resume_id ?? data?.id ?? null;
  } catch {
    return null;
  }
}

const PROFICIENCY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const COMMON_SKILLS = ["Java", "Python", "SQL", "REST APIs", "React", "Node.js", "C++", "AWS", "JavaScript", "TypeScript", "Docker", "Spring Boot"];

// Enriched company: combines placement listing + application status from both endpoints
// resolvedStatus = merged status (applications endpoint overrides company.application_status)
type EnrichedCompany = CompanyListItem & {
  resolvedStatus: string | null; // final merged status
  applicationId?: string;
  resolvedPackageMin?: number | null;
  resolvedPackageMax?: number | null;
  resolvedInterviewDate?: string | null;
};

export default function PlacementsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [eligibleCompanies, setEligibleCompanies] = useState<EnrichedCompany[]>([]);
  const [notEligibleCompanies, setNotEligibleCompanies] = useState<{ company: EnrichedCompany; error: string }[]>([]);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<EnrichedCompany | null>(null);
  const [showJDModal, setShowJDModal] = useState(false);
  const [jdCompany, setJdCompany] = useState<EnrichedCompany | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Activation modal state
  const [activating, setActivating] = useState(false);
  const [skills, setSkills] = useState<{ skill: string; proficiency: string }[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");
  const [currentProficiency, setCurrentProficiency] = useState(PROFICIENCY_OPTIONS[0]);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!showJDModal) return;
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return;
    mainContent.classList.add("modal-scroll-lock");
    return () => mainContent.classList.remove("modal-scroll-lock");
  }, [showJDModal]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const studentIdStr = sessionStorage.getItem("student_id");
        if (!studentIdStr) {
          router.replace("/login");
          return;
        }
        const studentId = Number(studentIdStr);

        // Fetch all data in parallel
        const [profileData, placementsData, applicationsData] = await Promise.all([
          getStudentProfile(studentId),
          getPlacements(studentId),
          getStudentApplications(studentId).catch(() => ({ applications: [] as ApplicationItem[], total: 0 })),
        ]);

        setProfile(profileData);

        // Build a map of companyId -> application for quick lookup
        const appByCompanyId = new Map<string, ApplicationItem>();
        applicationsData.applications.forEach((app) => {
          appByCompanyId.set(app.company_id, app);
        });

        // Enrich each company with application status
        const eligible: EnrichedCompany[] = [];
        const notEligible: { company: EnrichedCompany; error: string }[] = [];

        for (const company of placementsData.companies) {
          const app = appByCompanyId.get(company.id);
          const enriched: EnrichedCompany = {
            ...company,
            resolvedStatus: app?.application_status ?? company.application_status ?? null,
            applicationId: app?.application_id,
            resolvedPackageMin: app?.package_min ?? company.package_min,
            resolvedPackageMax: app?.package_max ?? company.package_max,
            resolvedInterviewDate: app?.interview_date ?? company.interview_date,
          };

          let isEligible = true;
          let errorMessage = "";

          if (company.min_cgpa !== null && profileData.cgpa < company.min_cgpa) {
            isEligible = false;
            errorMessage = `Your CGPA (${profileData.cgpa}) is below the required ${company.min_cgpa}`;
          } else if (company.max_backlogs !== null && profileData.backlogs > company.max_backlogs) {
            isEligible = false;
            errorMessage = `Your active backlogs (${profileData.backlogs}) exceed the maximum allowed (${company.max_backlogs})`;
          } else if (
            company.eligible_departments &&
            company.eligible_departments.length > 0 &&
            !company.eligible_departments.includes(profileData.department)
          ) {
            isEligible = false;
            errorMessage = `Your department (${profileData.department}) is not eligible for this role`;
          }

          if (isEligible) {
            eligible.push(enriched);
          } else {
            notEligible.push({ company: enriched, error: errorMessage });
          }
        }

        setEligibleCompanies(eligible);
        setNotEligibleCompanies(notEligible);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.includes("College not found")) {
          setError("Your account is not linked to a college. Please ask your administrator to invite you via your college email.");
        } else {
          setError("Failed to load placement data. Please check your connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    // Load skills
    const storedSkills = sessionStorage.getItem("known_skills_detailed");
    if (storedSkills) {
      try { setSkills(JSON.parse(storedSkills)); } catch {}
    } else {
      const primary = (sessionStorage.getItem("primary_skill") || "").toLowerCase();
      if (primary.includes("python")) {
        setSkills([{ skill: "Python", proficiency: "Advanced" }, { skill: "SQL", proficiency: "Intermediate" }]);
      } else if (primary.includes("react") || primary.includes("frontend") || primary.includes("javascript")) {
        setSkills([{ skill: "JavaScript", proficiency: "Advanced" }, { skill: "React", proficiency: "Advanced" }, { skill: "SQL", proficiency: "Intermediate" }]);
      } else {
        setSkills([{ skill: "Java", proficiency: "Advanced" }, { skill: "SQL", proficiency: "Intermediate" }]);
      }
    }

    loadData();
  }, [router]);

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const pendingCount = eligibleCompanies.filter(c => c.resolvedStatus === "INTERESTED").length;
  const approvedCount = eligibleCompanies.filter(c => c.resolvedStatus === "APPROVED").length;
  const rejectedCount = eligibleCompanies.filter(c => c.resolvedStatus === "REJECTED").length;
  const activatedCount = eligibleCompanies.filter(c => c.resolvedStatus === "ACTIVATED").length;

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleInterested = async (company: EnrichedCompany) => {
    try {
      setProcessingId(company.id);
      const studentId = Number(sessionStorage.getItem("student_id"));
      await markInterest(studentId, company.id);
      setEligibleCompanies(prev =>
        prev.map(c => c.id === company.id ? { ...c, resolvedStatus: "INTERESTED" } : c)
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setProcessingId(null);
    }
  };

  const handleActivateClick = (company: EnrichedCompany) => {
    setSelectedCompany(company);
  };

  const closeActivationModal = () => {
    setSelectedCompany(null);
    setActivating(false);
  };

  const handleConfirmActivate = async () => {
    if (!selectedCompany) return;
    try {
      setActivating(true);
      const studentId = Number(sessionStorage.getItem("student_id"));
      const activateResult = await activateCompany(studentId, selectedCompany.id);

      sessionStorage.setItem("known_skills_detailed", JSON.stringify(skills));
      sessionStorage.setItem("company_name", selectedCompany.company_name);
      sessionStorage.setItem("role", selectedCompany.role);

      if (activateResult && (activateResult as any).target_id) {
        sessionStorage.setItem("target_id", String((activateResult as any).target_id));
      }

      const resumeId = await fetchLatestResumeId(studentId);
      if (resumeId) sessionStorage.setItem("resume_id", String(resumeId));

      const primarySkill = skills.length > 0 ? skills[0].skill : "General";
      sessionStorage.setItem("primary_skill", primarySkill);

      // Update UI optimistically
      setEligibleCompanies(prev =>
        prev.map(c => c.id === selectedCompany.id ? { ...c, resolvedStatus: "ACTIVATED" } : c)
      );

      closeActivationModal();
      sessionStorage.setItem("target_activated", "true");
      router.push("/study-plan");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to activate company");
      setActivating(false);
    }
  };

  const updateSkillProficiency = (skillName: string, newProf: string) => {
    setSkills(skills.map(s => s.skill === skillName ? { ...s, proficiency: newProf } : s));
  };

  const removeSkill = (skillName: string) => {
    setSkills(skills.filter(s => s.skill !== skillName));
  };

  const handleAddSkill = () => {
    if (currentSkill.trim() && !skills.some(s => s.skill.toLowerCase() === currentSkill.trim().toLowerCase())) {
      setSkills([...skills, { skill: currentSkill.trim(), proficiency: currentProficiency }]);
      setCurrentSkill("");
    }
  };

  const getProficiencyBadgeStyle = (prof: string) => {
    if (prof === "Advanced") return "bg-emerald-50 text-emerald-600";
    if (prof === "Intermediate") return "bg-blue-50 text-blue-600";
    return "bg-amber-50 text-amber-700";
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────
  const renderActionButton = (company: EnrichedCompany) => {
    const status = company.resolvedStatus;

    if (status === "ACTIVATED") {
      return (
        <button
          onClick={() => {
            sessionStorage.setItem("company_name", company.company_name);
            sessionStorage.setItem("role", company.role);
            router.push("/study-plan");
          }}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition shadow-sm whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          View Study Plan
        </button>
      );
    }

    if (status === "APPROVED") {
      return (
        <button
          onClick={() => handleActivateClick(company)}
          className="flex items-center gap-2 px-5 py-2 rounded-xl border-2 border-indigo-600 text-indigo-700 bg-indigo-50 text-sm font-bold hover:bg-indigo-100 transition"
        >
          Activate
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      );
    }

    if (status === "INTERESTED") {
      return (
        <button
          disabled
          className="px-5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-bold text-sm flex items-center gap-1.5 cursor-not-allowed"
        >
          <span>Applied</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      );
    }

    if (status === "REJECTED") {
      return (
        <div className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-500 text-xs font-bold">
          Rejected
        </div>
      );
    }

    // Not applied yet
    return (
      <button
        onClick={() => handleInterested(company)}
        disabled={processingId === company.id}
        className="px-5 py-2 rounded-xl text-slate-800 border border-slate-300 font-bold text-sm hover:bg-slate-50 transition disabled:opacity-50 flex items-center gap-2"
      >
        {processingId === company.id ? <LoadingSpinner /> : "I'm interested"}
      </button>
    );
  };

  const renderStatusBadge = (company: EnrichedCompany) => {
    const status = company.resolvedStatus;
    if (status === "ACTIVATED") return (
      <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">Active</span>
    );
    if (status === "APPROVED") return (
      <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">Approved</span>
    );
    if (status === "INTERESTED") return (
      <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">Pending</span>
    );
    if (status === "REJECTED") return (
      <span className="bg-red-100 text-red-500 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">Rejected</span>
    );
    return (
      <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">Eligible</span>
    );
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <LoadingSpinner />
        <p className="mt-4 text-slate-500 font-medium">Loading placements...</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">{error}</div>;
  }

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in w-full max-w-4xl mx-auto py-4 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Placements
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your application status and preparation progress.</p>
        </div>
        <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500" /> Connected
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border-l-4 border-l-emerald-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Active (Approved)</p>
          <p className="text-3xl font-light text-emerald-700">{approvedCount}</p>
        </div>
        <div className="bg-white border-l-4 border-l-amber-500 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pending Approval</p>
          <p className="text-3xl font-light text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white border-l-4 border-l-red-500 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rejected</p>
          <p className="text-3xl font-light text-red-600">{rejectedCount}</p>
        </div>
        <div className="bg-white border-l-4 border-l-indigo-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Activated</p>
          <p className="text-3xl font-light text-indigo-700">{activatedCount}</p>
        </div>
      </div>

      {/* Profile bar */}
      {profile && (
        <div className="bg-[#fcf8f2] border border-[#f5ead7] rounded-lg px-4 py-3 mb-6 flex items-center text-sm gap-2 flex-wrap">
          <span className="font-bold text-slate-800">Your profile:</span>
          <span className="text-slate-600">CGPA {profile.cgpa} · Backlogs {profile.backlogs} · Dept {profile.department} ·</span>
          <span className={profile.is_verified ? "text-emerald-700 font-semibold" : "text-amber-600 font-semibold"}>
            {profile.is_verified ? "Marksheet verified ✓" : "Pending verification"}
          </span>
        </div>
      )}

      {/* Eligible companies section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-[15px] font-bold text-slate-800 whitespace-nowrap" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Companies — {eligibleCompanies.length} eligible
          </h2>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        {eligibleCompanies.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No eligible companies at the moment. Check back later.</p>
        ) : (
          <div className="space-y-3">
            {eligibleCompanies.map((company) => {
              const isActivated = company.resolvedStatus === "ACTIVATED";
              const isRejected = company.resolvedStatus === "REJECTED";
              return (
                <div
                  key={company.id}
                  className={`bg-white rounded-xl border shadow-sm p-5 transition hover:shadow-md ${
                    isActivated
                      ? "border-l-4 border-l-indigo-600 border-y-slate-200 border-r-slate-200 border-t-slate-200"
                      : isRejected
                      ? "border-slate-200 opacity-60"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Logo + Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg text-white font-bold text-xl bg-[#1e3a8a]">
                        {company.company_name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                            {company.company_name} — {company.role}
                          </h3>
                          {renderStatusBadge(company)}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                          {company.resolvedInterviewDate && (
                            <span className="flex items-center gap-1">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              {new Date(company.resolvedInterviewDate).toLocaleDateString()}
                            </span>
                          )}
                          {company.resolvedPackageMin && company.resolvedPackageMax && (
                            <span className="flex items-center gap-1">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              {company.resolvedPackageMin}–{company.resolvedPackageMax} LPA
                            </span>
                          )}
                          {company.min_cgpa && <span>CGPA {company.min_cgpa}+</span>}
                          {(company.eligible_departments ?? []).length > 0 && (
                            <span>{(company.eligible_departments ?? []).join(", ")}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Action button + JD button */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                      {company.job_description && (
                        <button
                          onClick={() => { setJdCompany(company); setShowJDModal(true); }}
                          className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-medium"
                        >
                          View JD
                        </button>
                      )}
                      {renderActionButton(company)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Not eligible section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-[15px] font-bold text-slate-500 whitespace-nowrap" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Not eligible companies ({notEligibleCompanies.length})
          </h2>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        {notEligibleCompanies.length === 0 ? (
          <div className="bg-white/60 rounded-xl border border-slate-200 p-8 text-center">
            <div className="text-3xl mb-2">🚫</div>
            <p className="text-sm text-slate-400">No ineligible companies at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notEligibleCompanies.map(({ company, error: eligErr }) => (
              <div key={company.id} className="bg-white/60 opacity-75 rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg text-white font-bold text-xl bg-slate-400 opacity-70">
                      {company.company_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-500" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                          {company.company_name} — {company.role}
                        </h3>
                        <span className="bg-red-50 text-red-400 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">Not eligible</span>
                      </div>
                      <p className="text-xs text-red-400 mt-0.5 font-medium">{eligErr}</p>
                    </div>
                  </div>
                  {company.job_description && (
                    <button
                      onClick={() => { setJdCompany(company); setShowJDModal(true); }}
                      className="flex-shrink-0 px-3 py-2 text-xs text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-medium"
                    >
                      View JD
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Activation Confirmation Modal ── */}
      {isMounted && selectedCompany && createPortal(
        <div className="fixed top-0 bottom-0 right-0 left-0 lg:left-[260px] bg-black/40 flex items-center justify-center z-60 p-4 overflow-y-auto">
          <div className="bg-white rounded-[20px] max-w-2xl w-full p-8 shadow-2xl animate-fade-in my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Confirm activation</h2>
              <button onClick={closeActivationModal} className="px-5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
            </div>

            <div className="bg-[#eff6ff] rounded-xl p-4 flex items-center gap-4 mb-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold bg-[#1e3a8a]">
                {selectedCompany.company_name[0]}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1e3a8a] leading-tight" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                  {selectedCompany.company_name} — {selectedCompany.role}
                </h3>
                <p className="text-[13px] text-blue-800/70 font-medium mt-0.5">
                  {selectedCompany.resolvedInterviewDate ? new Date(selectedCompany.resolvedInterviewDate).toLocaleDateString() : "TBD"}
                  {selectedCompany.resolvedPackageMin ? ` · ${selectedCompany.resolvedPackageMin}–${selectedCompany.resolvedPackageMax} LPA` : ""}
                </p>
              </div>
            </div>

            {/* Skills Review */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Review your current skills</h3>
              <p className="text-sm text-slate-500 mb-4">Your study plan will be personalized based on these skills. Edit if needed before activating.</p>

              {/* Add skill */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Add a new skill for this role</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      value={currentSkill}
                      onChange={e => setCurrentSkill(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddSkill()}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-medium"
                      placeholder="Select skill..."
                      list="modal-skills-list"
                    />
                    <datalist id="modal-skills-list">
                      {COMMON_SKILLS.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div className="relative w-40">
                    <select
                      value={currentProficiency}
                      onChange={e => setCurrentProficiency(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 appearance-none bg-white"
                    >
                      {PROFICIENCY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="flex items-center justify-center px-4 border border-slate-300 rounded-lg text-slate-800 font-bold text-sm hover:bg-slate-50 transition gap-1 whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Skills list */}
              <div className="space-y-3">
                {skills.map(s => (
                  <div key={s.skill} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 bg-white">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="font-bold text-slate-800 text-sm flex-1">{s.skill}</span>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${getProficiencyBadgeStyle(s.proficiency)}`}>
                        {s.proficiency}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      <div className="relative w-36">
                        <select
                          value={s.proficiency}
                          onChange={e => updateSkillProficiency(s.skill, e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 outline-none text-slate-800 appearance-none bg-white font-medium"
                        >
                          {PROFICIENCY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeSkill(s.skill)} className="text-slate-400 hover:text-red-500 px-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex justify-center gap-4 pt-2">
              <button onClick={closeActivationModal} className="px-6 py-3 rounded-xl border border-slate-300 text-slate-800 font-bold hover:bg-slate-50 transition w-32 text-center">
                Go back
              </button>
              <button
                onClick={handleConfirmActivate}
                disabled={activating}
                className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-900 text-white font-bold hover:bg-slate-800 transition w-56 text-center disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {activating && <LoadingSpinner />}
                Confirm and activate
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── JD Modal ── */}
      {isMounted && showJDModal && jdCompany && createPortal(
        <div className="fixed top-0 bottom-0 right-0 left-0 lg:left-[260px] bg-black/40 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl max-h-[80vh] w-full overflow-hidden flex flex-col">
            <div className="border-b border-slate-200 px-8 py-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                  {jdCompany.company_name} — {jdCompany.role}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Job Description</p>
              </div>
              <button onClick={() => setShowJDModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-8 py-6">
              {jdCompany.job_description ? (
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                  {jdCompany.job_description}
                </div>
              ) : (
                <p className="text-slate-500 italic">No job description provided yet.</p>
              )}
            </div>
            <div className="border-t border-slate-200 px-8 py-4 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowJDModal(false)}
                className="px-6 py-2.5 rounded-xl text-slate-700 border border-slate-300 font-bold text-[15px] hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
