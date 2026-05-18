"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyCreate, createCompany } from "@/lib/api";

const DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AI&DS"];

export default function AddCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    role: "",
    package_min: "",
    package_max: "",
    interview_date: "",
    min_cgpa: "",
    max_backlogs: "",
    eligible_departments: [] as string[],
    job_description: "",
  });

  const toggleDept = (dept: string) => {
    setFormData((prev) => {
      if (prev.eligible_departments.includes(dept)) {
        return { ...prev, eligible_departments: prev.eligible_departments.filter((d) => d !== dept) };
      }
      return { ...prev, eligible_departments: [...prev.eligible_departments, dept] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.company_name || 
      !formData.role || 
      !formData.package_min || 
      !formData.package_max || 
      !formData.interview_date || 
      !formData.min_cgpa || 
      !formData.max_backlogs || 
      formData.eligible_departments.length === 0 || 
      !formData.job_description
    ) {
      setError("Please fill in all fields and select at least one department.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: CompanyCreate = {
      company_name: formData.company_name,
      role: formData.role,
      package_min: formData.package_min ? parseFloat(formData.package_min) : undefined,
      package_max: formData.package_max ? parseFloat(formData.package_max) : undefined,
      interview_date: formData.interview_date || undefined,
      min_cgpa: formData.min_cgpa ? parseFloat(formData.min_cgpa) : undefined,
      max_backlogs: formData.max_backlogs ? parseInt(formData.max_backlogs) : undefined,
      eligible_departments: formData.eligible_departments,
      job_description: formData.job_description || undefined,
      status: "Active" // Defaulting to Active based on form publish
    };

    try {
      await createCompany(payload);
      router.push("/companies");
    } catch (err: any) {
      setError(err.message || "Failed to create company");
      setLoading(false);
    }
  };

  return (
    <div className="flex xl:h-screen flex-col bg-[#fdfdfd] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-100 px-8 py-5 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Companies / Add</h1>
        <div className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-400">
          College Admin
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add placement company</h2>
            <p className="mt-1 text-sm text-gray-500">One listing per company-role combination.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TCS"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Role <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Java Backend Dev"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Package (LPA) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="Min"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formData.package_min}
                    onChange={(e) => setFormData({ ...formData, package_min: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="Max"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formData.package_max}
                    onChange={(e) => setFormData({ ...formData, package_max: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Interview date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={formData.interview_date}
                  onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Min CGPA <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 6.5"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={formData.min_cgpa}
                  onChange={(e) => setFormData({ ...formData, min_cgpa: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Max backlogs <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 0"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={formData.max_backlogs}
                  onChange={(e) => setFormData({ ...formData, max_backlogs: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-6">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Eligible departments <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 p-2 overflow-y-auto max-h-32">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                      formData.eligible_departments.includes(dept)
                        ? "border-black bg-black text-white"
                        : "border-transparent bg-[#f9f9f9] text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Job description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={6}
                required
                placeholder="Paste full JD..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
                value={formData.job_description}
                onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl border border-black bg-black px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Publishing..." : "Publish"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
