"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  type DashboardSummary,
  getDashboardSummary,
  listAllTokenRequests,
  fulfillTokenRequest,
  rejectTokenRequest,
  type SuperAdminTokenRequestItem,
} from "@/lib/api";

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<SuperAdminTokenRequestItem[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});

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

  const loadPendingRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await listAllTokenRequests({ status: "PENDING", per_page: 10 });
      setPendingRequests(res.items);
    } catch {
      // Not critical
    } finally {
      setReqLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadPendingRequests();
  }, [loadSummary, loadPendingRequests]);

  const handleFulfill = async (req: SuperAdminTokenRequestItem) => {
    setActionLoading((p) => ({ ...p, [req.id]: true }));
    try {
      const res = await fulfillTokenRequest(req.id);
      setActionMessages((p) => ({
        ...p,
        [req.id]: `✓ ${res.tokens_allocated} sent`,
      }));
      void loadPendingRequests();
      void loadSummary();
    } catch (err) {
      setActionMessages((p) => ({
        ...p,
        [req.id]: err instanceof Error ? err.message : "Failed",
      }));
    } finally {
      setActionLoading((p) => ({ ...p, [req.id]: false }));
    }
  };

  const handleReject = async (req: SuperAdminTokenRequestItem) => {
    setActionLoading((p) => ({ ...p, [req.id]: true }));
    try {
      await rejectTokenRequest(req.id);
      setActionMessages((p) => ({ ...p, [req.id]: "Rejected" }));
      void loadPendingRequests();
    } catch (err) {
      setActionMessages((p) => ({
        ...p,
        [req.id]: err instanceof Error ? err.message : "Failed",
      }));
    } finally {
      setActionLoading((p) => ({ ...p, [req.id]: false }));
    }
  };

  return (
    <div className="px-8 py-6 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-gray-900 mb-1">Super admin dashboard</h1>
        <p className="text-[15px] text-gray-600">Manage colleges and token allocation.</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-10 w-full">
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Colleges</p>
          <p className="text-[28px] font-medium text-gray-900">
            {loading ? "..." : formatNumber(summary?.total_colleges ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Tokens Issued</p>
          <p className="text-[28px] font-medium text-gray-900">
            {loading ? "..." : formatNumber(summary?.total_tokens_issued ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Consumed</p>
          <p className="text-[28px] font-medium text-gray-900">
            {loading ? "..." : formatNumber(summary?.total_tokens_consumed ?? 0)}
          </p>
        </div>
        
        <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Pending Requests</p>
          <p className="text-[28px] font-medium text-gray-900">
            {reqLoading ? "..." : pendingRequests.length}
          </p>
        </div>
      </div>

      {/* Pending Requests Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[18px] font-bold text-gray-900">Pending token requests</h2>
          <Link
            href="/requests"
            className="text-[13px] text-blue-600 hover:underline font-medium"
          >
            View all →
          </Link>
        </div>

        {reqLoading ? (
          <div className="text-sm text-gray-400 py-6 text-center">Loading requests...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            No pending token requests. College admins will request here when they need tokens.
          </div>
        ) : (
          <div className="w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-[13px] text-gray-600 border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="font-medium py-3 px-4">College</th>
                  <th className="font-medium py-3 px-4 text-center">Admin</th>
                  <th className="font-medium py-3 px-4 text-center">Count</th>
                  <th className="font-medium py-3 px-4 text-center">Requested On</th>
                  <th className="font-medium py-3 px-4 text-center">Note</th>
                  <th className="font-medium py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4 font-medium text-gray-900">{req.college_name}</td>
                    <td className="py-4 px-4 text-center text-gray-700">{req.admin_name || "—"}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[13px]">
                        {req.count}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-gray-500 text-[13px]">
                      {new Date(req.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                    <td className="py-4 px-4 text-center text-gray-500 max-w-[120px] truncate">
                      {req.note || "—"}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {actionMessages[req.id] ? (
                        <span className={`text-[13px] font-medium ${actionMessages[req.id].includes("✓") ? "text-emerald-600" : "text-red-600"}`}>
                          {actionMessages[req.id]}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            disabled={actionLoading[req.id]}
                            onClick={() => void handleFulfill(req)}
                            className="bg-white border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-50"
                          >
                            {actionLoading[req.id] ? "..." : "Fulfill"}
                          </button>
                          <button
                            disabled={actionLoading[req.id]}
                            onClick={() => void handleReject(req)}
                            className="bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Activity */}
      {summary?.recent_activity && summary.recent_activity.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-[18px] font-bold text-gray-900">Recent activity</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {summary.recent_activity.slice(0, 5).map((act, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-4 ${i < summary.recent_activity.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div>
                  <span className="font-medium text-gray-900 text-sm">{act.college_name || "Unknown"}</span>
                  <span className="text-gray-500 text-sm ml-2">{act.type}</span>
                  {act.note && <span className="text-gray-400 text-xs ml-2">— {act.note}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${act.type === "CONSUMPTION" ? "text-red-500" : "text-emerald-600"}`}>
                    {act.type === "CONSUMPTION" ? "−" : "+"}{act.amount}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(act.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
