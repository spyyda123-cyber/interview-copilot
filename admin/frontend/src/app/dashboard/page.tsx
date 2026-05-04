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
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getColors = (idx: number) => {
    const colors = [
      "bg-indigo-100 text-indigo-700 border-indigo-200",
      "bg-purple-100 text-purple-700 border-purple-200",
      "bg-blue-100 text-blue-700 border-blue-200",
      "bg-emerald-100 text-emerald-700 border-emerald-200",
      "bg-amber-100 text-amber-700 border-amber-200",
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-white sm:bg-transparent">
      {/* Container */}
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-[32px] font-bold text-gray-900 tracking-tight font-serif">Dashboard</h1>
            <p className="mt-1 text-[13px] text-gray-500 font-medium">Placement Season overview</p>
          </div>
          {error && (
            <button
              onClick={loadSummary}
              className="text-sm font-medium text-red-600 hover:text-red-700 underline"
            >
              Retry loading
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 animate-pulse">Loading dashboard...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : summary ? (
          <>
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Card 1 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Total Students</div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">{summary.total_students}</div>
                  <div className="text-[11px] text-gray-500 font-medium">Registered this season</div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Eligible / Active</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">{summary.active_students}</div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      {summary.total_students > 0
                        ? Math.round((summary.active_students / summary.total_students) * 100)
                        : 0}% of total
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Active Companies</div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">{summary.active_companies}</div>
                  <div className="text-[11px] text-gray-500 font-medium">{summary.total_companies} total companies</div>
                </div>
              </div>

              {/* Card 4 */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
                <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Pending Approvals</div>
                <div>
                  <div className="text-3xl font-bold text-[#d97706] leading-none mb-1.5">{summary.pending_approvals}</div>
                  <div className="text-[11px] text-gray-500 font-medium">Awaiting your review</div>
                </div>
              </div>
            </div>

            {/* Bottom Section - 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Recent Applications Pane */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-900">Recent Applications</h2>
                  <Link href="/approvals" className="rounded-lg px-2 py-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-white transition-colors flex items-center gap-0.5 border border-transparent hover:border-gray-200 shadow-sm hover:shadow">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex flex-col gap-3">
                  {summary.recent_applications.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                      No applications found.
                    </div>
                  ) : (
                    summary.recent_applications.map((app, idx) => (
                      <Link href="/approvals" key={idx} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg border ${getColors(idx)} text-sm font-bold shadow-inner`}>
                            {getInitials(app.student_name)}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{app.student_name}</div>
                            <div className="mt-0.5 text-[12px] font-medium text-gray-500">{app.company_name} · {app.role}</div>
                          </div>
                        </div>
                        <div className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          app.status === "INTERESTED" ? "bg-amber-50 border-amber-200 text-amber-600" :
                          app.status === "APPROVED" || app.status === "ACTIVATED" ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                          "bg-red-50 border-red-200 text-red-600"
                        }`}>
                          {app.status === "INTERESTED" ? "Pending" : app.status}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Active Companies Pane */}
              <div className="flex flex-col lg:pl-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-900">Active Companies</h2>
                  <Link href="/companies" className="rounded-lg px-2 py-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-white transition-colors flex items-center gap-0.5 border border-transparent hover:border-gray-200 shadow-sm hover:shadow">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {summary.active_companies_list.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                    No active companies found.
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden text-sm">
                    <table className="w-full text-left">
                      <thead className="border-b border-gray-100 bg-gray-50/50">
                        <tr>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Company</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Role</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">CTC</th>
                          <th className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.active_companies_list.map((comp) => (
                          <tr key={comp.id} className="group hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-4 font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{comp.company_name}</td>
                            <td className="px-5 py-4 text-[13px] text-gray-600 font-medium">{comp.role}</td>
                            <td className="px-5 py-4 text-[13px] text-gray-600 font-medium whitespace-nowrap">
                              {comp.package_min ? `${comp.package_min} LPA` : "—"}
                            </td>
                            <td className="px-5 py-4 text-[13px] text-gray-500 font-medium">{comp.total_applied} ({comp.approved} approved)</td>
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
