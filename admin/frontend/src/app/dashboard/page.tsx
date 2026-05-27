"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getDashboardSummary, DashboardSummary } from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-[32px] font-bold text-[#222222] tracking-tight">Dashboard</h1>
            <p className="mt-1 text-[13px] text-[#888888] font-medium">Placement Season overview</p>
          </div>
          {error && (
            <button onClick={loadSummary} className="text-sm font-medium text-red-600 hover:text-red-700 underline">
              Retry loading
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-[#888888] animate-pulse">Loading dashboard...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        ) : summary ? (
          <>
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="rounded-xl border border-[#e8e8e8] bg-white p-5 flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Total Students</div>
                <div>
                  <div className="text-3xl font-bold text-[#222222] leading-none mb-1.5">{summary.total_students}</div>
                  <div className="text-[11px] text-[#888888] font-medium">Registered this season</div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e8e8e8] bg-white p-5 flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Eligible / Active</div>
                <div>
                  <div className="text-3xl font-bold text-[#222222] leading-none mb-1.5">{summary.active_students}</div>
                  <div className="text-[11px] text-[#888888] font-medium">
                    {summary.total_students > 0
                      ? Math.round((summary.active_students / summary.total_students) * 100)
                      : 0}% of total
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e8e8e8] bg-white p-5 flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Active Companies</div>
                <div>
                  <div className="text-3xl font-bold text-[#222222] leading-none mb-1.5">{summary.active_companies}</div>
                  <div className="text-[11px] text-[#888888] font-medium">{summary.total_companies} total companies</div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e8e8e8] bg-white p-5 flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Pending Approvals</div>
                <div>
                  <div className="text-3xl font-bold text-[#d9f36e] leading-none mb-1.5" style={{ color: summary.pending_approvals > 0 ? "#b45309" : "#222222" }}>
                    {summary.pending_approvals}
                  </div>
                  <div className="text-[11px] text-[#888888] font-medium">Awaiting your review</div>
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Applications */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[#222222]">Recent Applications</h2>
                  <Link href="/approvals" className="rounded-lg px-2 py-1 text-[13px] font-semibold text-[#555555] hover:text-[#222222] hover:bg-[#f3f3f3] transition-colors flex items-center gap-0.5 border border-transparent hover:border-[#e8e8e8]">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="flex flex-col gap-3">
                  {summary.recent_applications.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#e8e8e8] p-8 text-center text-sm text-[#aaaaaa]">
                      No applications found.
                    </div>
                  ) : (
                    summary.recent_applications.map((app, idx) => (
                      <Link
                        href="/approvals"
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-[#e8e8e8] bg-white p-4 hover:border-[#d9f36e] hover:bg-[#f7ffe0] transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] text-sm font-bold text-[#222222]">
                            {getInitials(app.student_name)}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-[#222222] group-hover:text-[#222222]">{app.student_name}</div>
                            <div className="mt-0.5 text-[12px] font-medium text-[#888888]">{app.company_name} · {app.role}</div>
                          </div>
                        </div>
                        <div className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          app.status === "INTERESTED" ? "bg-[#fff8e1] border-[#fcd34d] text-[#b45309]" :
                          app.status === "APPROVED" || app.status === "ACTIVATED" ? "bg-[#f7ffe0] border-[#d9f36e] text-[#222222]" :
                          "bg-red-50 border-red-200 text-red-600"
                        }`}>
                          {app.status === "INTERESTED" ? "Pending" : app.status}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Active Companies */}
              <div className="flex flex-col lg:pl-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[#222222]">Active Companies</h2>
                  <Link href="/companies" className="rounded-lg px-2 py-1 text-[13px] font-semibold text-[#555555] hover:text-[#222222] hover:bg-[#f3f3f3] transition-colors flex items-center gap-0.5 border border-transparent hover:border-[#e8e8e8]">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {summary.active_companies_list.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#e8e8e8] p-8 text-center text-sm text-[#aaaaaa]">
                    No active companies found.
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#e8e8e8] bg-white overflow-hidden text-sm">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#e8e8e8] bg-[#f3f3f3]">
                        <tr>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Company</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Role</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">CTC</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e8e8e8]">
                        {summary.active_companies_list.map((comp) => (
                          <tr key={comp.id} className="hover:bg-[#f7ffe0] transition-colors">
                            <td className="px-5 py-4 font-semibold text-[#222222]">{comp.company_name}</td>
                            <td className="px-5 py-4 text-[13px] text-[#555555] font-medium">{comp.role}</td>
                            <td className="px-5 py-4 text-[13px] text-[#555555] font-medium whitespace-nowrap">
                              {comp.package_min ? `${comp.package_min} LPA` : "—"}
                            </td>
                            <td className="px-5 py-4 text-[13px] text-[#888888] font-medium">{comp.total_applied} ({comp.approved} approved)</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
