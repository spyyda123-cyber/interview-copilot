"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  listAllTokenRequests,
  fulfillTokenRequest,
  rejectTokenRequest,
  type SuperAdminTokenRequestItem,
} from "@/lib/api";

// Inline SVG icons – no lucide-react dependency in this project
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function RequestsPage() {
  const [requests, setRequests] = useState<SuperAdminTokenRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [collegeFilter, setCollegeFilter] = useState("All colleges");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAllTokenRequests({ per_page: 100 });
      setRequests(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch =
        r.college_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.admin_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.admin_email || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "All status" ||
        r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchCollege =
        collegeFilter === "All colleges" || r.college_name === collegeFilter;
      return matchSearch && matchStatus && matchCollege;
    });
  }, [requests, search, statusFilter, collegeFilter]);

  const uniqueColleges = [...new Set(requests.map((r) => r.college_name))];
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const handleFulfill = async (req: SuperAdminTokenRequestItem) => {
    setActionLoading((p) => ({ ...p, [req.id]: true }));
    try {
      const res = await fulfillTokenRequest(req.id);
      setActionMessages((p) => ({
        ...p,
        [req.id]: `✓ ${res.tokens_allocated} tokens sent to ${req.college_name}`,
      }));
      void loadRequests();
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
      void loadRequests();
    } catch (err) {
      setActionMessages((p) => ({
        ...p,
        [req.id]: err instanceof Error ? err.message : "Failed",
      }));
    } finally {
      setActionLoading((p) => ({ ...p, [req.id]: false }));
    }
  };

  const getStatusStyle = (status: string) => {
    if (status === "PENDING")   return "bg-[#fefce8] text-[#85410e] border border-[#fef9c3]";
    if (status === "FULFILLED") return "bg-[#ecfdf5] text-[#047857] border border-[#d1fae5]";
    if (status === "REJECTED")  return "bg-red-50 text-red-700 border border-red-200";
    return "bg-gray-100 text-gray-700";
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "PENDING")   return <ClockIcon />;
    if (status === "FULFILLED") return <CheckIcon />;
    if (status === "REJECTED")  return <XIcon />;
    return null;
  };

  return (
    <div className="max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#111827]">Token requests</h1>
          <p className="text-lg text-[#6b7280] mt-1">
            Review and fulfill token requests from college admins.
          </p>
        </div>
        <button
          onClick={() => void loadRequests()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && !loading && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ⚡ {pendingCount} pending request{pendingCount > 1 ? "s" : ""} awaiting your action.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 bg-white text-[15px] appearance-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All status</option>
            <option>PENDING</option>
            <option>FULFILLED</option>
            <option>REJECTED</option>
          </select>
          <select
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 bg-white text-[15px] appearance-none cursor-pointer"
            value={collegeFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
          >
            <option>All colleges</option>
            {uniqueColleges.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Search by college or admin..."
          className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 text-[16px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex justify-end mb-4">
        <p className="text-sm text-[#6b7280]">
          Showing {filteredRequests.length} of {requests.length} requests
        </p>
      </div>

      {/* Table */}
      <div className="bg-[#f9fafb] border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-[#f9fafb]">
                <th className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider">COLLEGE</th>
                <th className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider">ADMIN</th>
                <th className="px-5 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider">COUNT</th>
                <th className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider">REQUESTED ON</th>
                <th className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider">NOTE</th>
                <th className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider text-center">STATUS</th>
                <th className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6b7280]">
                    Loading requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6b7280]">
                    No token requests found. College admins can request tokens from their token pool page.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5 text-[15px] font-bold text-[#111827]">{req.college_name}</td>
                    <td className="px-6 py-5">
                      <div className="text-[15px] font-medium text-[#4b5563]">{req.admin_name || "—"}</div>
                      <div className="text-[12px] text-gray-400">{req.admin_email || ""}</div>
                    </td>
                    <td className="px-5 py-5">
                      <span className="px-3 py-1 rounded-full bg-[#eff6ff] text-[#1e40af] text-[13px] font-bold">
                        {req.count}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-[14px] text-[#6b7280]">
                      {new Date(req.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-5 text-[14px] text-[#6b7280] max-w-[140px] truncate">
                      {req.note || "—"}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${getStatusStyle(req.status)}`}>
                        <StatusIcon status={req.status} />
                        {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {actionMessages[req.id] ? (
                        <span className={`text-[13px] font-medium ${actionMessages[req.id].includes("✓") ? "text-emerald-600" : "text-red-600"}`}>
                          {actionMessages[req.id]}
                        </span>
                      ) : req.status === "PENDING" ? (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            disabled={actionLoading[req.id]}
                            onClick={() => void handleFulfill(req)}
                            className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
                          >
                            {actionLoading[req.id] ? "..." : "Fulfill"}
                          </button>
                          <button
                            disabled={actionLoading[req.id]}
                            onClick={() => void handleReject(req)}
                            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-[13px] font-bold hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[13px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-[#f9fafb] border-t border-gray-200">
          <p className="text-sm text-[#6b7280]">
            {filteredRequests.length} of {requests.length} requests
          </p>
        </div>
      </div>
    </div>
  );
}
