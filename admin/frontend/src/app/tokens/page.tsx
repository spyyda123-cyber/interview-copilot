"use client";

import { useEffect, useState } from "react";
import { getTokenPool, type TokenPoolResponse } from "@/lib/api";

export default function TokenPoolPage() {
  const [data, setData] = useState<TokenPoolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="max-w-5xl px-4 py-4">
      <div className="mb-10">
        <h1 className="text-[28px] font-medium text-[#111827]">Token pool</h1>
        <p className="text-[17px] text-[#6b7280] mt-1">Request hashed tokens from super admin. Auto-consumed when students activate.</p>
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
          <p className="text-3xl font-semibold text-[#111827]">{loading ? "..." : data?.total_allocated ?? "100"}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-[#9ca3af] uppercase mb-2">Consumed</p>
          <p className="text-3xl font-semibold text-[#111827]">{loading ? "..." : data?.total_consumed ?? "9"}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-widest text-[#9ca3af] uppercase mb-2">Available</p>
          <p className="text-3xl font-semibold text-[#111827]">{loading ? "..." : data?.balance ?? "91"}</p>
        </div>
      </div>

      {/* Request Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm mb-8">
        <h2 className="text-[19px] font-bold text-[#111827] mb-6">Request more tokens</h2>
        
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="flex-1">
            <label className="block text-[13px] font-semibold text-[#374151] mb-2">Count needed</label>
            <input 
              type="number" 
              placeholder="50" 
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 focus:border-[#10b981] text-[15px]" 
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-[13px] font-semibold text-[#374151] mb-2">Note</label>
            <input 
              type="text" 
              placeholder="description" 
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 focus:border-[#10b981] text-[15px]" 
            />
          </div>
        </div>

        <button className="bg-white border border-gray-300 text-[#111827] hover:bg-gray-50 px-8 py-3 rounded-xl text-[16px] font-semibold tracking-wide shadow-sm transition-all focus:ring-2 focus:ring-gray-200 focus:outline-none">
          Request Tokens
        </button>
      </div>

      {/* Footer Info Box */}
      <div className="rounded-xl bg-[#fefce8]/60 border border-[#fef9c3] p-4 text-[12px] text-[#854d0e] leading-relaxed">
        <span className="font-bold">Flow:</span> Admin requests -&gt; Super admin generates hashed tokens -&gt; Tokens appear in pool. When student clicks &quot;Activate&quot; on an approved company, 1 token is consumed from pool at backend. Admin never manually assigns tokens.
      </div>
    </div>
  );
}
