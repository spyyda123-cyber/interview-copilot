"use client";

import { useEffect, useState } from "react";
import { getTokenPool, createTokenRequest, listTokenRequests, type TokenPoolResponse, type TokenRequestResponse } from "@/lib/api";
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
    try { setData(await getTokenPool()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load token pool."); }
    finally { setLoading(false); }
  };

  const loadRequests = async () => {
    setReqLoading(true);
    try { const res = await listTokenRequests(1, 20); setRequests(res.items); }
    catch { /* Not critical */ }
    finally { setReqLoading(false); }
  };

  useEffect(() => { void loadPool(); void loadRequests(); }, []);

  const handleRequestTokens = async () => {
    const parsedCount = parseInt(count, 10);
    if (!parsedCount || parsedCount <= 0) { setSubmitError("Please enter a valid count."); return; }
    setSubmitting(true); setSubmitError(null); setSubmitSuccess(null);
    try {
      await createTokenRequest({ count: parsedCount, note: note || undefined });
      setSubmitSuccess(`Request for ${parsedCount} tokens submitted to super admin.`);
      setCount(""); setNote("");
      void loadRequests();
    } catch (err) { setSubmitError(err instanceof Error ? err.message : "Failed to submit request."); }
    finally { setSubmitting(false); }
  };

  const getStatusIcon = (status: string) => {
    if (status === "FULFILLED") return <CheckCircle className="h-4 w-4 text-[#222222]" />;
    if (status === "REJECTED") return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-[#b45309]" />;
  };

  const getStatusStyle = (status: string) => {
    if (status === "FULFILLED") return "bg-[#f7ffe0] text-[#222222] border border-[#d9f36e]";
    if (status === "REJECTED") return "bg-red-50 text-red-700 border border-red-200";
    return "bg-[#fff8e1] text-[#b45309] border border-[#fcd34d]";
  };

  return (
    <div className="max-w-5xl px-4 py-4">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-[#222222]">Token pool</h1>
        <p className="text-[15px] text-[#555555] mt-1">Request tokens from super admin. Auto-consumed when students activate.</p>
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Tokens", value: loading ? "..." : data?.total_allocated ?? 0 },
          { label: "Consumed", value: loading ? "..." : data?.total_consumed ?? 0 },
          { label: "Available", value: loading ? "..." : data?.balance ?? 0 },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-[#e8e8e8] rounded-xl p-5 flex flex-col justify-between h-[100px]">
            <p className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">{card.label}</p>
            <p className="text-3xl font-bold text-[#222222] leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Request Form */}
      <div className="bg-white border border-[#e8e8e8] rounded-xl p-6 mb-8">
        <h2 className="text-[18px] font-bold text-[#222222] mb-5">Request more tokens</h2>
        {submitSuccess && <div className="mb-4 rounded-lg border border-[#d9f36e] bg-[#f7ffe0] px-4 py-3 text-sm text-[#222222] font-semibold">✓ {submitSuccess}</div>}
        {submitError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div>}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="md:w-[180px]">
            <label className="block text-[12px] font-semibold text-[#555555] mb-1.5 uppercase tracking-wide">Count needed</label>
            <input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder="50" min="1" className="w-full px-3 py-2.5 rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] text-[#222222] focus:outline-none focus:border-[#d9f36e] text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-[#555555] mb-1.5 uppercase tracking-wide">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Placement season April 2026" className="w-full px-3 py-2.5 rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] text-[#222222] focus:outline-none focus:border-[#d9f36e] text-sm" />
          </div>
        </div>
        <button onClick={handleRequestTokens} disabled={submitting} className="bg-[#222222] text-[#d9f36e] hover:bg-[#d9f36e] hover:text-[#222222] disabled:opacity-50 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors">
          {submitting ? "Submitting..." : "Request Tokens"}
        </button>
      </div>

      {/* Past Requests */}
      <div className="bg-white border border-[#e8e8e8] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8e8e8]">
          <h2 className="text-[15px] font-bold text-[#222222]">Past requests</h2>
        </div>
        {reqLoading ? (
          <div className="px-5 py-8 text-center text-sm text-[#aaaaaa]">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#aaaaaa]">No token requests yet.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f3f3f3] border-b border-[#e8e8e8]">
              <tr>
                {["Count", "Note", "Status", "Requested"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-[#888888] uppercase tracking-[0.1em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e8e8]">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-[#f7ffe0] transition-colors">
                  <td className="px-5 py-4 font-bold text-[#222222]">{req.count}</td>
                  <td className="px-5 py-4 text-[#555555] max-w-[200px] truncate">{req.note || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusStyle(req.status)}`}>
                      {getStatusIcon(req.status)} {req.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#888888] text-xs">
                    {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-5 rounded-xl bg-[#f7ffe0] border border-[#d9f36e] p-4 text-xs text-[#222222] leading-relaxed">
        <span className="font-bold">Flow:</span> Admin requests → Super admin reviews & fulfills → Tokens appear in pool. When student clicks "Activate" on an approved company, 1 token is consumed from pool.
      </div>
    </div>
  );
}
