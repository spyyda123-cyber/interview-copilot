"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FeedbackModal from "../components/FeedbackModal";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  getFeedbackByCompany,
  getStudentApplications,
  activateCompany,
  type PendingFeedbackItem,
  type FeedbackResponse,
  type ApplicationItem,
} from "@/src/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Helper to get the student's latest resume_id from the backend
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
const COMMON_SKILLS = ["Java", "Python", "SQL", "REST APIs", "React", "Node.js", "C++", "AWS"];

export default function InterviewsPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<ApplicationItem | null>(null);
  const [skills, setSkills] = useState<{skill: string, proficiency: string}[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");
  const [currentProficiency, setCurrentProficiency] = useState(PROFICIENCY_OPTIONS[0]);
  const [feedbackModal, setFeedbackModal] = useState<{ interview: PendingFeedbackItem } | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackResponse[]>>({});
  const [viewingFeedback, setViewingFeedback] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedInterview) return;
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return;
    mainContent.classList.add("modal-scroll-lock");
    return () => mainContent.classList.remove("modal-scroll-lock");
  }, [selectedInterview]);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const studentIdStr = sessionStorage.getItem("student_id");
        if (!studentIdStr) {
          router.replace("/login");
          return;
        }
        const studentId = Number(studentIdStr);
        const res = await getStudentApplications(studentId);
        setApplications(res.applications);
      } catch (err) {
        console.error("Failed to fetch applications:", err);
        setError("Failed to load your interview list.");
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();

    // Load skills — prefer sessionStorage, then derive from student's primary skill
    const storedSkills = sessionStorage.getItem("known_skills_detailed");
    if (storedSkills) {
      try {
        setSkills(JSON.parse(storedSkills));
      } catch (e) {}
    } else {
      // Build default skills based on the student's primary_skill from their profile
      const storedPrimary = (sessionStorage.getItem("primary_skill") || "").toLowerCase();
      if (storedPrimary.includes("python")) {
        setSkills([
          { skill: "Python", proficiency: "Advanced" },
          { skill: "SQL", proficiency: "Intermediate" },
        ]);
      } else if (storedPrimary.includes("frontend") || storedPrimary.includes("react") || storedPrimary.includes("javascript")) {
        setSkills([
          { skill: "JavaScript", proficiency: "Advanced" },
          { skill: "React", proficiency: "Advanced" },
          { skill: "SQL", proficiency: "Intermediate" },
        ]);
      } else if (storedPrimary.includes("backend")) {
        setSkills([
          { skill: "Backend", proficiency: "Advanced" },
          { skill: "SQL", proficiency: "Intermediate" },
        ]);
      } else {
        // Java or unknown → default to Java
        setSkills([
          { skill: "Java", proficiency: "Advanced" },
          { skill: "SQL", proficiency: "Intermediate" },
        ]);
      }
    }
  }, [router]);

  const handleActivateClick = (interview: ApplicationItem) => {
    setSelectedInterview(interview);
  };

  const closeModal = () => {
    setSelectedInterview(null);
  };

  const [activating, setActivating] = useState(false);

  const handleConfirmActivate = async () => {
    if (!selectedInterview) return;
    try {
      setActivating(true);
      const studentId = Number(sessionStorage.getItem("student_id"));
      
      // Activate company - response includes target_id from backend
      const activateResult = await activateCompany(studentId, selectedInterview.company_id);
      
      // Save updated skills and context
      sessionStorage.setItem("known_skills_detailed", JSON.stringify(skills));
      sessionStorage.setItem("company_name", selectedInterview.company_name);
      sessionStorage.setItem("role", selectedInterview.role);
      
      // CRITICAL FIX: Set target_id from activation response (was previously being removed!)
      if (activateResult && (activateResult as any).target_id) {
        sessionStorage.setItem("target_id", String((activateResult as any).target_id));
      }

      // Fetch and store resume_id so /plan page can load
      const resumeId = await fetchLatestResumeId(studentId);
      if (resumeId) {
        sessionStorage.setItem("resume_id", String(resumeId));
      }

      // Save primary skill for study plan module selection
      const primarySkill = skills.length > 0 ? skills[0].skill : "General";
      sessionStorage.setItem("primary_skill", primarySkill);

      closeModal();
      sessionStorage.setItem("target_activated", "true");
      // Navigate to the interactive study plan (Q&A, quiz, coding)
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

  const pendingApprovals = applications.filter(a => a.application_status === "INTERESTED");
  const approvedInterviews = applications.filter(a => a.application_status === "APPROVED");
  const rejectedInterviews = applications.filter(a => a.application_status === "REJECTED");
  const activatedInterviews = applications.filter(a => a.application_status === "ACTIVATED");

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <LoadingSpinner />
        <p className="mt-4 text-slate-500 font-medium">Loading interviews...</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">{error}</div>;
  }

  return (
    <div className="animate-fade-in w-full max-w-4xl mx-auto py-4 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Interview list</h1>
        <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Connected
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border-l-4 border-l-emerald-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Active (Approved)</p>
          <p className="text-3xl font-light text-emerald-700">{approvedInterviews.length}</p>
        </div>
        <div className="bg-white border-l-4 border-l-amber-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pending Approval</p>
          <p className="text-3xl font-light text-amber-700">{pendingApprovals.length}</p>
        </div>
        <div className="bg-white border-l-4 border-l-red-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rejected</p>
          <p className="text-3xl font-light text-red-600">{rejectedInterviews.length}</p>
        </div>
        <div className="bg-white border-l-4 border-l-indigo-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Activated</p>
          <p className="text-3xl font-light text-indigo-700">{activatedInterviews.length}</p>
        </div>
      </div>

      {/* Approved Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 leading-tight" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Approved companies — activate to start prep</h2>
        <p className="text-sm text-slate-500 mb-4">Activated companies move to Study Plan and disappear from here.</p>
        
        <div className="space-y-3">
          {approvedInterviews.length === 0 && (
            <p className="text-sm text-slate-500">No approved companies yet.</p>
          )}
          {approvedInterviews.map((interview) => {
            const isPast = interview.interview_date ? new Date(interview.interview_date) < new Date() : false;
            const hasFeedback = feedbackMap[interview.company_name]?.length > 0;
            return (
            <div key={interview.application_id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between transition hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xl bg-[#1e3a8a]`}>
                  {interview.company_name[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {interview.company_name} — {interview.role}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {interview.interview_date ? new Date(interview.interview_date).toLocaleDateString() : "TBD"}
                    {interview.package_min ? ` · ${interview.package_min}-${interview.package_max} LPA` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isPast && (
                  hasFeedback ? (
                    <button
                      onClick={() => setViewingFeedback(viewingFeedback === interview.company_name ? null : interview.company_name)}
                      className="px-4 py-2 rounded-xl text-indigo-700 border border-indigo-200 bg-indigo-50 font-bold text-sm hover:bg-indigo-100 transition flex items-center gap-1.5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      View Feedback
                    </button>
                  ) : (
                    <button
                      onClick={() => setFeedbackModal({
                        interview: {
                          company_name: interview.company_name,
                          role: interview.role,
                          interview_date: interview.interview_date || new Date().toISOString(),
                        },
                      })}
                      className="px-4 py-2 rounded-xl text-amber-700 border border-amber-200 bg-amber-50 font-bold text-sm hover:bg-amber-100 transition flex items-center gap-1.5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Give Feedback
                    </button>
                  )
                )}
                <button 
                  onClick={() => handleActivateClick(interview)}
                  className="px-6 py-2 rounded-xl text-slate-800 border border-slate-300 font-bold text-sm hover:bg-slate-50 transition flex items-center gap-2"
                >
                  Activate
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Pending Section */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-slate-800 mb-3" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Pending approval</h2>
        
        <div className="space-y-3">
          {pendingApprovals.length === 0 && (
            <p className="text-sm text-slate-500">No pending approvals.</p>
          )}
          {pendingApprovals.map((interview) => (
            <div key={interview.application_id} className="bg-[var(--bg-muted)] opacity-80 rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xl bg-[#a855f7] opacity-70`}>
                  {interview.company_name[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-500" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {interview.company_name} — {interview.role}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {interview.interview_date ? new Date(interview.interview_date).toLocaleDateString() : "TBD"}
                    {interview.package_min ? ` · ${interview.package_min}-${interview.package_max} LPA` : ""}
                  </p>
                </div>
              </div>
              <div className="bg-[#fef3c7] text-[#d97706] px-3 py-1 text-xs font-semibold rounded-md border border-[#fde68a]">
                Pending
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activation Modal Overlay */}
      {isMounted && selectedInterview && createPortal(
        <div className="fixed top-0 bottom-0 right-0 left-0 lg:left-[260px] bg-black/40 flex items-center justify-center z-60 p-4 overflow-y-auto">
          <div className="bg-white rounded-[20px] max-w-2xl w-full p-8 shadow-2xl animate-fade-in my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Confirm activation</h2>
              <button onClick={closeModal} className="px-5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
            </div>

            <div className="bg-[#eff6ff] rounded-xl p-4 flex items-center gap-4 mb-8">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold bg-[#1e3a8a]`}>
                {selectedInterview.company_name[0]}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1e3a8a] leading-tight" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                  {selectedInterview.company_name} — {selectedInterview.role}
                </h3>
                <p className="text-[13px] text-blue-800/70 font-medium mt-0.5">
                  {selectedInterview.interview_date ? new Date(selectedInterview.interview_date).toLocaleDateString() : "TBD"}
                  {selectedInterview.package_min ? ` · ${selectedInterview.package_min}-${selectedInterview.package_max} LPA` : ""}
                </p>
              </div>
            </div>

            {/* Skills Review */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Review your current skills</h3>
              <p className="text-sm text-slate-500 mb-4">Your study plan will be personalized based on these skills. Edit if needed before activating.</p>
              
              {/* Add New Skill (Modal inside Modal component style) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Add a new skill for this role</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input 
                      value={currentSkill} 
                      onChange={e => setCurrentSkill(e.target.value)} 
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-medium" 
                      placeholder="Select skill..." 
                      list="modal-skills-list"
                    />
                    <datalist id="modal-skills-list">
                      {COMMON_SKILLS.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <div className="absolute right-3 top-3 text-slate-400 cursor-pointer pointer-events-none">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddSkill}
                    className="flex items-center justify-center px-4 border border-slate-300 rounded-lg text-slate-800 font-bold text-sm hover:bg-slate-50 transition gap-1 whitespace-nowrap"
                  >
                    <span>+</span> Add
                  </button>
                </div>
              </div>

              {/* Skills List */}
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
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 appearance-none bg-white font-medium"
                        >
                          {PROFICIENCY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeSkill(s.skill)} className="text-slate-400 hover:text-red-500 px-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-center gap-4 pt-2">
              <button onClick={closeModal} className="px-6 py-3 rounded-xl border border-slate-300 text-slate-800 font-bold hover:bg-slate-50 transition w-32 text-center">
                Go back
              </button>
              <button onClick={handleConfirmActivate} disabled={activating} className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-900 text-white font-bold hover:bg-slate-800 transition w-56 text-center disabled:opacity-50 flex justify-center items-center gap-2">
                {activating && <LoadingSpinner />}
                Confirm and activate
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Feedback Modal */}
      {feedbackModal && (
        <FeedbackModal
          interview={feedbackModal.interview}
          studentId={Number(sessionStorage.getItem("student_id") || "0")}
          onClose={() => setFeedbackModal(null)}
          onSubmitted={(fb) => {
            setFeedbackModal(null);
            setFeedbackMap((prev) => ({
              ...prev,
              [fb.company_name]: [...(prev[fb.company_name] || []), fb],
            }));
          }}
        />
      )}

    </div>
  );
}
