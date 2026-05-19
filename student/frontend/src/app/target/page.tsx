"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { getStudentProfile, getPlacements, markInterest, type StudentProfileResponse, type CompanyListItem } from "@/src/lib/api";
import LoadingSpinner from "../components/LoadingSpinner";

export default function TargetPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [eligibleCompanies, setEligibleCompanies] = useState<CompanyListItem[]>([]);
  const [notEligibleCompanies, setNotEligibleCompanies] = useState<{company: CompanyListItem, error: string}[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyListItem | null>(null);
  const [showJDModal, setShowJDModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!showJDModal) return;
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return;
    mainContent.classList.add("modal-scroll-lock");
    return () => mainContent.classList.remove("modal-scroll-lock");
  }, [showJDModal]);

  useEffect(() => {
    const fetchPlacements = async () => {
      try {
        setLoading(true);
        const studentIdStr = sessionStorage.getItem("student_id");
        if (!studentIdStr) {
          router.replace("/login");
          return;
        }
        
        const studentId = Number(studentIdStr);
        
        // Fetch profile to get CGPA and backlogs
        const profileData = await getStudentProfile(studentId);
        setProfile(profileData);
        
        // Fetch placement companies
        const placementsData = await getPlacements(studentId);
        
        // Filter into eligible vs not eligible
        const eligible: CompanyListItem[] = [];
        const notEligible: {company: CompanyListItem, error: string}[] = [];
        
        for (const company of placementsData.companies) {
          let isEligible = true;
          let errorMessage = "";
          
          if (company.min_cgpa !== null && profileData.cgpa < company.min_cgpa) {
            isEligible = false;
            errorMessage = `Your CGPA (${profileData.cgpa}) is below the required ${company.min_cgpa}`;
          } else if (company.max_backlogs !== null && profileData.backlogs > company.max_backlogs) {
            isEligible = false;
            errorMessage = `Your active backlogs (${profileData.backlogs}) exceed the maximum allowed (${company.max_backlogs})`;
          } else if (company.eligible_departments && company.eligible_departments.length > 0 && !company.eligible_departments.includes(profileData.department)) {
            isEligible = false;
            errorMessage = `Your department (${profileData.department}) is not eligible for this role`;
          }
          
          if (isEligible) {
            eligible.push(company);
          } else {
            notEligible.push({ company, error: errorMessage });
          }
        }
        
        setEligibleCompanies(eligible);
        setNotEligibleCompanies(notEligible);
        
      } catch (err) {
        console.error("Failed to load placements:", err);
        const message = err instanceof Error ? err.message : "";
        if (message.includes("College not found")) {
          setError("Your account is not linked to a college database. Please ask your administrator to invite you via your college email.");
        } else {
          setError("Failed to load placement data. Please check your connection and try again later.");
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlacements();
  }, [router]);

  const handleInterested = async (company: CompanyListItem) => {
    try {
      setProcessingId(company.id);
      const studentId = Number(sessionStorage.getItem("student_id"));
      await markInterest(studentId, company.id);
      
      // Update UI locally without refetching
      setEligibleCompanies(prev => prev.map(c => 
        c.id === company.id ? { ...c, application_status: "INTERESTED" } : c
      ));
      
      // We don't automatically redirect, they can apply to multiple
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewJD = (company: CompanyListItem) => {
    setSelectedCompany(company);
    setShowJDModal(true);
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

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64">
          <LoadingSpinner />
          <p className="mt-4 text-slate-500 font-medium">Analyzing eligibility...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      ) : (
        <>
          {/* Profile Bar */}
          <div className="bg-[#fcf8f2] border border-[#f5ead7] rounded-lg px-4 py-3 mb-6 flex items-center text-sm">
            <span className="font-bold text-slate-800 mr-2">Your profile:</span>
            <span className="text-slate-600">CGPA {profile?.cgpa} · Backlogs {profile?.backlogs} · Dept {profile?.department} · </span>
            <span className={profile?.is_verified ? "text-emerald-700 font-semibold ml-1" : "text-amber-600 font-semibold ml-1"}>
              {profile?.is_verified ? "Marksheet verified" : "Pending verification"}
            </span>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white border-l-4 border-l-emerald-700 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm h-[80px]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Eligible</p>
              <p className="text-3xl font-light text-emerald-700 leading-none">{eligibleCompanies.length}</p>
            </div>
            <div className="bg-white border-l-4 border-l-red-700 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm h-[80px]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Not Eligible</p>
              <p className="text-3xl font-light text-red-700 leading-none">{notEligibleCompanies.length}</p>
            </div>
            <div className="bg-white border-l-4 border-l-indigo-600 border-y border-y-slate-200 border-r border-r-slate-200 p-4 shadow-sm h-[80px]">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Total Companies</p>
              <p className="text-3xl font-light text-slate-800 leading-none">{eligibleCompanies.length + notEligibleCompanies.length}</p>
            </div>
          </div>

      {/* Eligible Section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-[15px] font-bold text-emerald-700 whitespace-nowrap" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Eligible for your profile ({eligibleCompanies.length})
          </h2>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="space-y-4">
          {eligibleCompanies.length === 0 && (
            <p className="text-sm text-slate-500">No eligible companies at the moment.</p>
          )}
          {eligibleCompanies.map((company) => {
            const isApplied = company.application_status !== null;
            return (
            <div key={company.id} className="bg-white rounded-[14px] border border-slate-200 shadow-sm p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg text-white font-bold text-xl bg-[#1e3a8a]`}>
                    {company.company_name[0]}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {company.company_name} — {company.role}
                  </h3>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-xs font-bold shrink-0">
                  Eligible
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-5 pl-15 ml-[60px]">
                  {company.package_min && company.package_max && (
                    <span className="bg-[#f1f5f9] text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      {company.package_min}-{company.package_max} LPA
                    </span>
                  )}
                  {company.min_cgpa && (
                    <span className="bg-[#f1f5f9] text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      CGPA {company.min_cgpa}+
                    </span>
                  )}
                  {company.max_backlogs !== null && (
                    <span className="bg-[#f1f5f9] text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      Backlogs: {company.max_backlogs}
                    </span>
                  )}
                  {company.eligible_departments?.length > 0 && (
                    <span className="bg-[#f1f5f9] text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      {company.eligible_departments.join(", ")}
                    </span>
                  )}
                  {company.interview_date && (
                    <span className="bg-[#f1f5f9] text-slate-600 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      {new Date(company.interview_date).toLocaleDateString()}
                    </span>
                  )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 ml-[60px]">
                {isApplied ? (
                  <button 
                    disabled
                    className="px-6 py-2.5 rounded-xl text-emerald-700 border border-emerald-300 bg-emerald-50 font-bold text-[15px] w-[160px]"
                  >
                    Applied ✓
                  </button>
                ) : (
                  <button 
                    onClick={() => handleInterested(company)}
                    disabled={processingId === company.id}
                    className="px-6 py-2.5 rounded-xl text-slate-800 border border-slate-300 font-bold text-[15px] hover:bg-slate-50 transition w-[160px] disabled:opacity-50"
                  >
                    {processingId === company.id ? <LoadingSpinner /> : "I'm interested"}
                  </button>
                )}
                <button 
                  onClick={() => handleViewJD(company)}
                  className="px-6 py-2.5 rounded-xl text-slate-800 border border-slate-300 font-bold text-[15px] hover:bg-slate-50 transition w-[140px]"
                >
                  View JD
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Not Eligible Section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-[15px] font-bold text-red-700 whitespace-nowrap" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
            Not eligible for your profile ({notEligibleCompanies.length})
          </h2>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="space-y-4">
          {notEligibleCompanies.length === 0 && (
            <p className="text-sm text-slate-500">No ineligible companies.</p>
          )}
          {notEligibleCompanies.map(({company, error}) => (
            <div key={company.id} className="bg-white/60 opacity-80 rounded-[14px] border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg text-white font-bold text-xl bg-[#64748b] opacity-70`}>
                    {company.company_name[0]}
                  </div>
                  <h3 className="text-lg font-bold text-slate-500" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                    {company.company_name} — {company.role}
                  </h3>
                </div>
                <div className="bg-red-50/50 text-red-400 px-3 py-1 rounded-md text-xs font-bold shrink-0">
                  Not eligible
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-2 pl-15 ml-[60px]">
                  {company.package_min && company.package_max && (
                    <span className="bg-[#f8fafc] text-slate-400 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                      {company.package_min}-{company.package_max} LPA
                    </span>
                  )}
                  {company.min_cgpa && (
                    <span className={`bg-[#f8fafc] border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md ${profile && profile.cgpa < company.min_cgpa ? 'text-red-400' : 'text-slate-400'}`}>
                      CGPA {company.min_cgpa}+
                    </span>
                  )}
                  {company.max_backlogs !== null && (
                    <span className={`bg-[#f8fafc] border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md ${profile && profile.backlogs > company.max_backlogs ? 'text-red-400' : 'text-slate-400'}`}>
                      Backlogs: {company.max_backlogs}
                    </span>
                  )}
              </div>

              {/* Error Message */}
              <div className="flex items-center gap-1.5 ml-[60px] mb-5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><circle cx="12" cy="12" r="10"></circle></svg>
                <p className="text-[13px] font-medium text-red-400">{error}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 ml-[60px]">
                <button disabled className="px-6 py-2.5 rounded-xl text-slate-300 border border-slate-200 font-bold text-[15px] w-[160px] bg-slate-50/50 cursor-not-allowed">
                  Not eligible
                </button>
                <button 
                  onClick={() => handleViewJD(company)}
                  className="px-6 py-2.5 rounded-xl text-slate-500 border border-slate-300 font-bold text-[15px] hover:bg-slate-50 transition w-[140px]"
                >
                  View JD
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* JD Modal */}
      {isMounted && showJDModal && selectedCompany && createPortal(
        <div className="fixed top-0 bottom-0 right-0 left-0 lg:left-[260px] bg-black/40 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl max-h-[80vh] w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-200 px-8 py-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
                  {selectedCompany.company_name} — {selectedCompany.role}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Job Description</p>
              </div>
              <button 
                onClick={() => setShowJDModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-8 py-6">
              {selectedCompany.job_description ? (
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                  {selectedCompany.job_description}
                </div>
              ) : (
                <p className="text-slate-500 italic">No job description provided yet.</p>
              )}
            </div>

            {/* Footer */}
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
