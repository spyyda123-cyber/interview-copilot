"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { type DashboardSummary, getDashboardSummary } from "@/lib/api";

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

const MOCK_PENDING_REQUESTS = [
  { id: "1", college: "KG College", admin: "Naveen", count: 100, requestedOn: "Mar 28 2026", note: "Placement seas...", status: "Pending" },
  { id: "2", college: "SRM Trichy", admin: "Priya", count: 200, requestedOn: "Mar 27 2026", note: "Campus drive r...", status: "Pending" },
];

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
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="px-8 py-6 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-gray-900 mb-1">Super admin dashboard</h1>
        <p className="text-[15px] text-gray-600">Manage colleges and hashed token generation.</p>
      </div>

      {error ? (
        <div className="mb-8 rounded-xl border border-[var(--color-danger)]/40 bg-red-50 p-4 text-sm text-[var(--color-danger)]">
          <p>{error}</p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-[var(--color-danger)] px-3 py-2 text-white"
            onClick={() => void loadSummary()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-4 mb-10 w-full">
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Colleges</p>
          <p className="text-[28px] font-medium text-gray-900">{loading ? "..." : formatNumber(summary?.total_colleges ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Tokens Generated</p>
          <p className="text-[28px] font-medium text-gray-900">{loading ? "..." : formatNumber(summary?.total_tokens_issued ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Consumed</p>
          <p className="text-[28px] font-medium text-gray-900">{loading ? "..." : formatNumber(summary?.total_tokens_consumed ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Pending Requests</p>
          <p className="text-[28px] font-medium text-gray-900">3</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-[18px] font-bold text-gray-900 mb-2">Pending requests</h2>
        <div className="w-full">
          <table className="w-full text-sm text-left">
            <thead className="text-[13px] text-gray-600 border-b border-gray-300">
              <tr>
                <th className="font-medium pb-2 px-4 pl-1">College</th>
                <th className="font-medium pb-2 px-4 text-center">Admin</th>
                <th className="font-medium pb-2 px-4 text-center">Count</th>
                <th className="font-medium pb-2 px-4 text-center">Requested On</th>
                <th className="font-medium pb-2 px-4 text-center">Note</th>
                <th className="font-medium pb-2 px-4 text-center">Status</th>
                <th className="font-medium pb-2 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PENDING_REQUESTS.map((req) => (
                <tr key={req.id} className="border-b border-gray-200 hover:bg-gray-50/50 transition-colors">
                  <td className="py-5 px-4 pl-1 font-medium text-gray-900">{req.college}</td>
                  <td className="py-5 px-4 text-center text-gray-900">{req.admin}</td>
                  <td className="py-5 px-4 text-center text-gray-900">{req.count}</td>
                  <td className="py-5 px-4 text-center text-gray-900">{req.requestedOn}</td>
                  <td className="py-5 px-4 text-center text-gray-900">{req.note}</td>
                  <td className="py-5 px-4 text-center">
                    <span className="inline-block px-3 py-1 rounded-full text-[13px] font-medium bg-yellow-100 text-yellow-800">
                      {req.status}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <Link
                      href={`/generate-tokens?college=${encodeURIComponent(req.college)}&count=${req.count}`}
                      className="inline-block bg-white border hover:bg-gray-50 border-gray-300 text-gray-900 px-6 py-2 rounded-xl text-[15px] font-semibold tracking-wide shadow-sm transition-all focus:ring-2 focus:ring-gray-200 focus:outline-none"
                    >
                      Generate
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
