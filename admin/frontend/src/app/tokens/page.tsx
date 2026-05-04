"use client";

import { useEffect, useState } from "react";
import {
  getTokenPool,
  createTokenRequest,
  listTokenRequests,
  type TokenPoolResponse,
  type TokenRequestResponse,
} from "@/lib/api";
import { CheckCircle, Clock, XCircle } from "lucide-react";

export default function TokenPoolPage() {
  const [data, setData] = useState<TokenPoolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requests, setRequests] = useState<TokenRequestResponse[]>([]);
  const [reqLoading, setReqLoading] = useState(true);

  const loadPool = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTokenPool());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load token pool.");
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setReqLoading(true);
    try {
      const res = await listTokenRequests(1, 20);
      setRequests(res.items);
    } catch {
      // Not critical
    } finally {
      setReqLoading(false);
    }
  };

  useEffect(() => {
    void loadPool();
    void loadRequests();
  }, []);

  const handleRequestTokens = async () => {
    const parsedCount = parseInt(count, 10);
    if (!parsedCount || parsedCount <= 0) {
      setSubmitError("Please enter a valid count.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await createTokenRequest({ count: parsedCount, note: note || undefined });
      setSubmitSuccess(`Request for ${parsedCount} tokens submitted to super admin.`);
      setCount("");
      setNote("");
      void loadRequests();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "FULFILLED") return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (status === "REJECTED") return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  const getStatusStyle = (status: string) => {
    if (status === "FULFILLED") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (status === "REJECTED") return "bg-red-50 text-red-700 border border-red-200";
    return "bg-amber-50 text-amber-700 border border-amber-200";
  };

  return (
    <div className="max-w-5xl px-4 py-4">
      <div className="mb-10">
        <h1 className="text-[28px] font-medium text-[#111827]">Token pool</h1>
        <p className="text-[17px] text-[#6b7280] mt-1">
          Request hashed tokens from super admin. Auto-consumed when students activate.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-[#9ca3af] uppercase mb-2">Total Tokens</p>
          <p className="text-3xl font-semibold text-[#111827]">
            {loading ? "..." : data?.total_allocated ?? 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-[#9ca3af] uppercase mb-2">Consumed</p>
          <p className="text-3xl font-semibold text-[#111827]">
            {loading ? "..." : data?.total_consumed ?? 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-[#9ca3af] uppercase mb-2">Available</p>
          <p className="text-3xl font-semibold text-[#111827]">
            {loading ? "..." : data?.balance ?? 0}
          </p>
        </div>
      </div>

      {/* Request Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm mb-8">
        <h2 className="text-[19px] font-bold text-[#111827] mb-6">Request more tokens</h2>

        {submitSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ {submitSuccess}
          </div>
        )}
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="md:w-[200px]">
            <label className="block text-[13px] font-semibold text-[#374151] mb-2">Count needed</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="50"
              min="1"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 focus:border-[#10b981] text-[15px]"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-[13px] font-semibold text-[#374151] mb-2">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Placement season April 2026"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 focus:border-[#10b981] text-[15px]"
            />
          </div>
        </div>

        <button
          onClick={handleRequestTokens}
          disabled={submitting}
          className="bg-white border border-gray-300 text-[#111827] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-xl text-[16px] font-semibold tracking-wide shadow-sm transition-all focus:ring-2 focus:ring-gray-200 focus:outline-none"
        >
          {submitting ? "Submitting..." : "Request Tokens"}
        </button>
      </div>

      {/* Past Requests */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-[#111827]">Past requests</h2>
        </div>
        {reqLoading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No token requests yet.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Count</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Note</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-[#1e40af]">{req.count}</td>
                  <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{req.note || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${getStatusStyle(req.status)}`}>
                      {getStatusIcon(req.status)}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {new Date(req.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric"
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 rounded-xl bg-[#fefce8]/60 border border-[#fef9c3] p-4 text-[12px] text-[#854d0e] leading-relaxed">
        <span className="font-bold">Flow:</span> Admin requests → Super admin reviews &amp; fulfills →
        Tokens appear in pool. When student clicks &quot;Activate&quot; on an approved company,
        1 token is consumed from pool. Admin never manually assigns tokens.
      </div>
    </div>
  );
}
