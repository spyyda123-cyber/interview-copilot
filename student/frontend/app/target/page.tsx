"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STUDENT_PROFILE = {
  cgpa: 8.2,
  backlogs: 0,
  dept: "CSE",
};

const STATS = {
  eligible: 4,
  notEligible: 1,
  total: 5,
};

const ELIGIBLE_COMPANIES = [
  {
    id: 1,
    company: "TCS",
    role: "Java Backend Developer",
    logoText: "T",
    logoColor: "bg-[#1e3a8a]",
    tags: ["3.5-7 LPA", "CGPA 6.5+", "Backlogs: 0", "CSE, IT", "Mar 25"]
  },
  {
    id: 2,
    company: "TCS",
    role: "Data Analyst",
    logoText: "T",
    logoColor: "bg-[#1e3a8a]",
    tags: ["4-8 LPA", "CGPA 7.0+", "Backlogs: 0", "CSE, IT, ECE", "Mar 25"]
  },
  {
    id: 3,
    company: "Google",
    role: "SDE Intern",
    logoText: "G",
    logoColor: "bg-[#ea4335]",
    tags: ["12-18 LPA", "CGPA 8.0+", "Backlogs: 0", "CSE", "Apr 2"]
  },
  {
    id: 4,
    company: "Infosys",
    role: "Systems Engineer",
    logoText: "I",
    logoColor: "bg-[#0ea5e9]",
    tags: ["3.6-5 LPA", "CGPA 6.0+", "Backlogs: max 1", "All depts", "Apr 10"]
  }
];

const NOT_ELIGIBLE_COMPANIES = [
  {
    id: 5,
    company: "Wipro",
    role: "Full Stack Developer",
    logoText: "W",
    logoColor: "bg-[#a855f7]",
    tags: [
      { text: "3.5-6 LPA", isError: false },
      { text: "CGPA 6.0+", isError: false },
      { text: "Backlogs: max 2", isError: true },
      { text: "All depts", isError: false },
      { text: "Apr 15", isError: false }
    ],
    errorMessage: "Your department (CSE) is eligible but this company requires different skill alignment"
  }
];

export default function TargetPage() {
  const router = useRouter();

  const handleInterested = (companyName: string, role: string) => {
    sessionStorage.setItem("company_name", companyName);
    sessionStorage.setItem("role", role);
    // Mock jdText for continuity with previous steps
    sessionStorage.setItem("jd_text", `Mock JD for ${companyName} - ${role}`);
    sessionStorage.removeItem("target_id");
    router.push("/resume");
  };

  return (
    <div className="animate-fade-in w-full max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Upcoming placements</h1>
        <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Connected
        </div>
      </div>

      {/* Profile Bar */}
      <div className="bg-[#fcf8f2] border border-[#f5ead7] rounded-lg px-4 py-3 mb-6 flex items-center text-sm">
        <span className="font-bold text-slate-800 mr-2">Your profile:</span>
        <span className="text-slate-600">CGPA {STUDENT_PROFILE.cgpa} · Backlogs {STUDENT_PROFILE.backlogs} · Dept {STUDENT_PROFILE.dept} · </span>
        <span className="text-emerald-700 font-semibold ml-1">Marksheet verified</span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white border-l-4 border-l-emerald-700 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm h-[80px]">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Eligible</p>
          <p className="text-3xl font-light text-emerald-700 leading-none">{STATS.eligible}</p>
        </div>
        <div className="bg-white border-l-4 border-l-red-700 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm h-[80px]">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Not Eligible</p>
          <p className="text-3xl font-light text-red-700 leading-none">{STATS.notEligible}</p>
        </div>
        <div className="bg-white border-l-4 border-l-indigo-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm h-[80px]">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Total Companies</p>
          <p className="text-3xl font-light text-slate-800 leading-none">{STATS.total}</p>
        </div>
      </div>

      {/* Eligible Section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-[15px] font-bold text-emerald-700 whitespace-nowrap" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Eligible for your profile ({STATS.eligible})
          </h2>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="space-y-4">
          {ELIGIBLE_COMPANIES.map((company) => (
            <div key={company.id} className="bg-white rounded-[14px] border border-slate-200 shadow-sm p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg text-white font-bold text-xl ${company.logoColor}`}>
                    {company.logoText}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {company.company} — {company.role}
                  </h3>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-xs font-bold shrink-0">
                  Eligible
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-5 pl-15 ml-[60px]">
                {company.tags.map(tag => (
                  <span key={tag} className="bg-[#f1f5f9] text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 ml-[60px]">
                <button 
                  onClick={() => handleInterested(company.company, company.role)}
                  className="px-6 py-2.5 rounded-xl text-slate-800 border border-slate-300 font-bold text-[15px] hover:bg-slate-50 transition w-[160px]"
                >
                  I'm interested
                </button>
                <button className="px-6 py-2.5 rounded-xl text-slate-800 border border-slate-300 font-bold text-[15px] hover:bg-slate-50 transition w-[140px]">
                  View JD
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Not Eligible Section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-[15px] font-bold text-red-700 whitespace-nowrap" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Not eligible for your profile ({STATS.notEligible})
          </h2>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="space-y-4">
          {NOT_ELIGIBLE_COMPANIES.map((company) => (
            <div key={company.id} className="bg-white/60 opacity-80 rounded-[14px] border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg text-white font-bold text-xl ${company.logoColor} opacity-70`}>
                    {company.logoText}
                  </div>
                  <h3 className="text-lg font-bold text-slate-500" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {company.company} — {company.role}
                  </h3>
                </div>
                <div className="bg-red-50/50 text-red-400 px-3 py-1 rounded-md text-xs font-bold shrink-0">
                  Not eligible
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-2 pl-15 ml-[60px]">
                {company.tags.map(tag => (
                  <span key={tag.text} className={`bg-[#f8fafc] border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md ${tag.isError ? 'text-red-400' : 'text-slate-400'}`}>
                    {tag.text}
                  </span>
                ))}
              </div>

              {/* Error Message */}
              <div className="flex items-center gap-1.5 ml-[60px] mb-5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><circle cx="12" cy="12" r="10"></circle></svg>
                <p className="text-[13px] font-medium text-red-400">{company.errorMessage}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 ml-[60px]">
                <button disabled className="px-6 py-2.5 rounded-xl text-slate-300 border border-slate-200 font-bold text-[15px] w-[160px] bg-slate-50/50 cursor-not-allowed">
                  Not eligible
                </button>
                <button className="px-6 py-2.5 rounded-xl text-slate-500 border border-slate-300 font-bold text-[15px] hover:bg-slate-50 transition w-[140px]">
                  View JD
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
