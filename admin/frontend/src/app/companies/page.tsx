"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CompanyResponse, listCompanies } from "@/lib/api";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResponse | null>(null);
  const [showJDModal, setShowJDModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await listCompanies(1, 100);
        setCompanies(data.items);
      } catch (err: any) {
        setError(err.message || "Failed to load companies");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleViewJD = (company: CompanyResponse) => {
    setSelectedCompany(company);
    setShowJDModal(true);
  };

  return (
    <div>
      <div className="p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#222222]">Placement companies</h2>
              <p className="mt-1 text-sm text-[#555555]">Add companies with roles. Same company can have multiple role listings.</p>
            </div>
            <Link href="/companies/new" className="inline-flex items-center gap-2 rounded-xl border border-[#e8e8e8] bg-white px-4 py-2 text-sm font-semibold text-[#222222] hover:bg-[#f3f3f3] transition-colors">
              <Plus className="h-4 w-4" /> Add company
            </Link>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

          <div className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e8e8e8] bg-[#f3f3f3]">
                  <tr>
                    {["Company — Role", "Package", "CGPA", "Date", "JD", "Interested", "Approved", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e8e8]">
                  {loading ? (
                    <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#aaaaaa]">Loading companies...</td></tr>
                  ) : companies.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#aaaaaa]">No companies added yet. Click "Add company" to begin.</td></tr>
                  ) : (
                    companies.map((comp) => (
                      <tr key={comp.id} className="hover:bg-[#f7ffe0] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap font-semibold text-[#222222]">
                          {comp.company_name} <span className="text-[#888888] font-normal">— {comp.role}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-semibold text-[#222222]">
                          {comp.package_min && comp.package_max ? `${comp.package_min}-${comp.package_max}L` : comp.package_min ? `${comp.package_min}L` : "—"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-[#555555]">{comp.min_cgpa ? comp.min_cgpa.toFixed(1) : "—"}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-[#555555]">
                          {comp.interview_date ? new Date(comp.interview_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <button onClick={() => handleViewJD(comp)} className="rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-1.5 text-xs font-semibold text-[#222222] hover:bg-[#d9f36e] hover:border-[#d9f36e] transition-colors">
                            View JD
                          </button>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-[#222222]">{comp.interested_count}</td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-[#222222]">{comp.approved_count}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            comp.status === "Active" ? "bg-[#f7ffe0] text-[#222222] border border-[#d9f36e]"
                            : comp.status === "Review" ? "bg-[#fff8e1] text-[#b45309] border border-[#fcd34d]"
                            : "bg-[#f3f3f3] text-[#555555] border border-[#e8e8e8]"
                          }`}>{comp.status}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <Link href={`/companies/${comp.id}/edit`} className="rounded-lg border border-[#e8e8e8] bg-white px-3 py-1.5 text-xs font-semibold text-[#222222] hover:bg-[#f3f3f3] transition-colors inline-block">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#e8e8e8] bg-[#f3f3f3] px-5 py-4">
              <p className="text-xs text-[#888888] leading-relaxed max-w-3xl">
                <span className="font-bold text-[#222222]">Multiple roles:</span> Same company can have separate listings for different roles. Each has its own eligibility criteria and JD.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* JD Modal */}
      {showJDModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl max-h-[80vh] w-full overflow-hidden flex flex-col border border-[#e8e8e8]">
            <div className="border-b border-[#e8e8e8] px-6 py-5 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-[#222222]">{selectedCompany.company_name} — {selectedCompany.role}</h2>
                <p className="text-sm text-[#888888] mt-0.5">Job Description</p>
              </div>
              <button onClick={() => setShowJDModal(false)} className="p-2 hover:bg-[#f3f3f3] rounded-lg transition-colors">
                <svg className="w-5 h-5 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-5">
              {selectedCompany.job_description ? (
                <div className="text-sm text-[#222222] whitespace-pre-wrap leading-relaxed">{selectedCompany.job_description}</div>
              ) : (
                <p className="text-[#888888] italic">No job description provided yet.</p>
              )}
            </div>
            <div className="border-t border-[#e8e8e8] px-6 py-4 flex justify-end bg-[#f3f3f3]">
              <button onClick={() => setShowJDModal(false)} className="px-5 py-2 rounded-lg text-[#222222] border border-[#e8e8e8] bg-white font-semibold text-sm hover:bg-[#f3f3f3] transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
