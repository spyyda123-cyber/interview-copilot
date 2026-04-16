"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PROFICIENCY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const COMMON_SKILLS = ["Java", "Python", "SQL", "REST APIs", "React", "Node.js", "C++", "AWS"];

const APPROVED_INTERVIEWS = [
  {
    id: 1,
    company: "TCS",
    role: "Java Backend Developer",
    details: "Mar 25, 2026 · Full-time · 3.5-7 LPA",
    shortDetails: "Mar 25 · 3.5-7 LPA",
    logoText: "T",
    logoColor: "bg-[#1e3a8a]",
  },
  {
    id: 2,
    company: "Google",
    role: "SDE Intern",
    details: "Apr 2, 2026 · Internship · 12-18 LPA",
    shortDetails: "Apr 2 · 12-18 LPA",
    logoText: "G",
    logoColor: "bg-[#ea4335]",
  },
  {
    id: 3,
    company: "Infosys",
    role: "Systems Engineer",
    details: "Apr 10, 2026 · Full-time · 3.6-5 LPA",
    shortDetails: "Apr 10 · 3.6-5 LPA",
    logoText: "I",
    logoColor: "bg-[#0ea5e9]",
  },
];

const PENDING_INTERVIEWS = [
  {
    id: 4,
    company: "Wipro",
    role: "Full Stack Dev",
    shortDetails: "Apr 15 · 3.5-6 LPA",
    logoText: "W",
    logoColor: "bg-[#a855f7]",
  },
];

export default function InterviewsPage() {
  const router = useRouter();
  const [selectedInterview, setSelectedInterview] = useState<typeof APPROVED_INTERVIEWS[0] | null>(null);
  const [skills, setSkills] = useState<{skill: string, proficiency: string}[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");
  const [currentProficiency, setCurrentProficiency] = useState(PROFICIENCY_OPTIONS[0]);

  useEffect(() => {
    // When opening page, load skills from session if any exist
    const storedSkills = sessionStorage.getItem("known_skills_detailed");
    if (storedSkills) {
      try {
        setSkills(JSON.parse(storedSkills));
      } catch (e) {}
    } else {
      // Dummy baseline if empty for mockup purposes
      setSkills([
        { skill: "Java", proficiency: "Advanced" },
        { skill: "SQL", proficiency: "Intermediate" },
        { skill: "REST APIs", proficiency: "Advanced" },
        { skill: "Python", proficiency: "Beginner" }
      ]);
    }
  }, []);

  const handleActivateClick = (interview: typeof APPROVED_INTERVIEWS[0]) => {
    setSelectedInterview(interview);
  };

  const closeModal = () => {
    setSelectedInterview(null);
  };

  const handleConfirmActivate = () => {
    // Save updated skills and mock transition
    sessionStorage.setItem("known_skills_detailed", JSON.stringify(skills));
    sessionStorage.setItem("company_name", selectedInterview!.company);
    sessionStorage.setItem("role", selectedInterview!.role);
    closeModal();
    // In a real flow, this would call an API and then forward them to study plan or target
    // For now we'll route to /study-plan as mock behavior
    router.push("/study-plan");
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
          <p className="text-3xl font-light text-emerald-700">3</p>
        </div>
        <div className="bg-white border-l-4 border-l-amber-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pending Approval</p>
          <p className="text-3xl font-light text-amber-700">1</p>
        </div>
        <div className="bg-white border-l-4 border-l-red-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rejected</p>
          <p className="text-3xl font-light text-red-600">1</p>
        </div>
        <div className="bg-white border-l-4 border-l-indigo-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Activated</p>
          <p className="text-3xl font-light text-indigo-700">0</p>
        </div>
      </div>

      {/* Approved Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 leading-tight" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Approved companies — activate to start prep</h2>
        <p className="text-sm text-slate-500 mb-4">Activated companies move to Study Plan and disappear from here.</p>
        
        <div className="space-y-3">
          {APPROVED_INTERVIEWS.map((interview) => (
            <div key={interview.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between transition hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xl ${interview.logoColor}`}>
                  {interview.logoText}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {interview.company} — {interview.role}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{interview.shortDetails}</p>
                </div>
              </div>
              <button 
                onClick={() => handleActivateClick(interview)}
                className="px-6 py-2 rounded-xl text-slate-800 border border-slate-300 font-bold text-sm hover:bg-slate-50 transition"
              >
                Activate
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Section */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-slate-800 mb-3" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Pending approval</h2>
        
        <div className="space-y-3">
          {PENDING_INTERVIEWS.map((interview) => (
            <div key={interview.id} className="bg-[var(--bg-muted)] opacity-80 rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xl ${interview.logoColor} opacity-70`}>
                  {interview.logoText}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-500" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {interview.company} — {interview.role}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{interview.shortDetails}</p>
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
      {selectedInterview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[20px] max-w-2xl w-full p-8 shadow-2xl animate-fade-in my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Confirm activation</h2>
              <button onClick={closeModal} className="px-5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
            </div>

            {/* Target Banner */}
            <div className="bg-[#eff6ff] rounded-xl p-4 flex items-center gap-4 mb-8">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold ${selectedInterview.logoColor}`}>
                {selectedInterview.logoText}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1e3a8a] leading-tight" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                  {selectedInterview.company} — {selectedInterview.role}
                </h3>
                <p className="text-[13px] text-blue-800/70 font-medium mt-0.5">{selectedInterview.details}</p>
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
              <button onClick={handleConfirmActivate} className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-900 text-white font-bold hover:bg-slate-800 transition w-56 text-center">
                Confirm and activate
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
