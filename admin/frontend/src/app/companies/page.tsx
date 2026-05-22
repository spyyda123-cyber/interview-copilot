"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CompanyResponse, listCompanies } from "@/lib/api";

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

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
      <div className="p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Placement companies</h2>
              <p className="mt-1 text-sm text-gray-500">
                Add companies with roles. Same company can have multiple role listings.
              </p>
            </div>
            <Link
              href="/companies/new"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add company
            </Link>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-white">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">Company &mdash; Role</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">Package</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">CGPA</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">Date</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">JD</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">Interested</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">Approved</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm font-medium text-gray-400">
                        Loading companies...
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm font-medium text-gray-400">
                        No companies added yet. Click &quot;Add company&quot; to begin.
                      </td>
                    </tr>
                  ) : (
                    companies.map((comp) => (
                      <tr key={comp.id} className="transition-colors hover:bg-[#f9fafb]">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {comp.company_name} <span className="text-gray-400 font-normal">&mdash; {comp.role}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">
                          {comp.package_min && comp.package_max
                            ? `${comp.package_min}-${comp.package_max}L`
                            : comp.package_min
                            ? `${comp.package_min}L`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">
                          {comp.min_cgpa ? comp.min_cgpa.toFixed(1) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-600">
                          {comp.interview_date
                            ? new Date(comp.interview_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button 
                            onClick={() => handleViewJD(comp)}
                            className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#4f46e5] transition-all hover:bg-[#f8fafc]"
                          >
                            View JD
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{comp.interested_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{comp.approved_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {comp.status === "Active" ? (
                            <span className="inline-flex rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[10px] font-bold text-[#059669]">
                              Active
                            </span>
                          ) : comp.status === "Review" ? (
                            <span className="inline-flex rounded-full bg-[#fffbeb] px-2.5 py-1 text-[10px] font-bold text-[#d97706]">
                              Review
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600">
                              {comp.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link 
                            href={`/companies/${comp.id}/edit`}
                            className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50 inline-block"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-100 bg-[#fafafa] px-6 py-5">
              <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                <span className="font-bold text-gray-700">Multiple roles:</span> TCS has 2 separate listings — Java Backend Dev and Data Analyst. Students see these as separate cards. Each has its own eligibility criteria and JD.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* JD Modal */}
      {showJDModal && selectedCompany && (
        <div className="fixed inset-y-0 right-0 left-64 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl max-h-[80vh] w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 px-8 py-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedCompany.company_name} — {selectedCompany.role}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Job Description</p>
              </div>
              <button 
                onClick={() => setShowJDModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-8 py-6">
              {selectedCompany.job_description ? (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {selectedCompany.job_description}
                </div>
              ) : (
                <p className="text-gray-500 italic">No job description provided yet.</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-8 py-4 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setShowJDModal(false)}
                className="px-6 py-2.5 rounded-lg text-gray-700 border border-gray-300 font-semibold text-sm hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
