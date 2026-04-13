"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useMemo } from "react";

const mockColleges = [
  "KG College",
  "KG College of Engineering",
  "SRM Trichy",
  "MIT, Chennai",
  "IIT Madras",
];

const MOCK_PREVIEWS = [
  { token: "x7f5a9k2", statusColor: "orange", date: "Mar 23" },
  { token: "m4b8z1q6", statusColor: "orange", date: "Mar 23" },
  { token: "p2d5w8n3", statusColor: "green", date: "Mar 23" },
  { token: "k9v1j4r7", statusColor: "green", date: "Mar 26" },
  { token: "t6h2c8f5", statusColor: "green", date: "Mar 26" },
];

function GenerateTokensContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCollege = searchParams.get("college") || "";
  const initialCount = searchParams.get("count") ? parseInt(searchParams.get("count") as string, 10) : 100;

  const [college, setCollege] = useState(initialCollege);
  const [count, setCount] = useState(initialCount);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllTokens, setShowAllTokens] = useState(false);

  // Automatically select an initial college from the URL if valid, or just let it be a generic entry.
  const allColleges = [...new Set([...mockColleges, initialCollege].filter(Boolean))];

  const allTokens = useMemo(() => {
    const result = [...MOCK_PREVIEWS];
    if (count > 5) {
      for (let i = 5; i < count; i++) {
        result.push({
          token: `t${i}h${Math.floor(Math.random() * 10)}c${Math.floor(Math.random() * 10)}f${Math.floor(Math.random() * 10)}`,
          statusColor: "green",
          date: "Mar 26",
        });
      }
    }
    return result.slice(0, count);
  }, [count]);

  const visibleTokens = showAllTokens ? allTokens : allTokens.slice(0, 5);

  return (
    <>
      <div className="px-8 py-6 max-w-[1200px]">
        <div className="mb-8">
          <h1 className="text-[24px] font-medium text-gray-900 mb-1">Generate hashed tokens</h1>
          <p className="text-[15px] text-gray-600">Cryptographically random, non-guessable 8-char strings.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 max-w-4xl mb-6">
          <h2 className="text-[17px] font-bold text-gray-900 mb-6">Token generation</h2>

          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="flex-1">
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">College</label>
              <select
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:24px_24px] bg-[right_12px_center] bg-no-repeat pr-10"
              >
                {allColleges.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:w-[200px]">
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Count</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                min="1"
              />
            </div>
          </div>

          <div className="rounded-lg bg-[#f8f9f2] p-5 mb-8 border border-transparent">
            <p className="text-[13px] font-medium text-gray-700 mb-2">Sample preview:</p>
            <div className="flex gap-4 font-mono text-[14px]">
              {MOCK_PREVIEWS.map((p) => (
                <span key={p.token} className="text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{p.token}</span>
              ))}
            </div>
          </div>

          <button 
            onClick={() => {
              setIsModalOpen(true);
              setShowAllTokens(false);
            }}
            className="bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 px-6 py-2.5 rounded-xl text-[16px] font-semibold tracking-wide shadow-sm transition-all focus:ring-2 focus:ring-gray-200 focus:outline-none"
          >
            Generate {count || 0} tokens
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-semibold text-gray-900">Token Delivery Status</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-6">
              <div className="flex flex-col items-center mb-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 13L9 17L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-1">{count} tokens successfully delivered</h3>
                <p className="text-sm text-gray-500">Now available in {college || "the selected"} admin&apos;s token pool.</p>
              </div>

              <table className="w-full text-[13px] text-left">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="font-medium pb-2 px-2">Token (hashed)</th>
                    <th className="font-medium pb-2 px-2 text-center">Status</th>
                    <th className="font-medium pb-2 px-2 text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTokens.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2.5 px-2 font-mono text-indigo-500">
                        {item.token}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium leading-tight ${item.statusColor === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          Delivered
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-900 font-medium">
                        {item.date}
                      </td>
                    </tr>
                  ))}
                  {!showAllTokens && count > 5 && (
                    <tr 
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setShowAllTokens(true)}
                    >
                      <td colSpan={3} className="py-4 text-center text-[13px] text-gray-500 border-b border-gray-100 font-medium">
                        ... {count - 5} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 flex justify-end shrink-0 border-t border-gray-50">
              <button 
                onClick={() => {
                  // Update request status in sessionStorage if an ID was passed
                  const requestId = searchParams.get("id");
                  if (requestId) {
                    const stored = sessionStorage.getItem("token_requests");
                    if (stored) {
                      const requests = JSON.parse(stored);
                      const updated = requests.map((r: any) => 
                        r.id === parseInt(requestId, 10) ? { ...r, status: "Assigned" } : r
                      );
                      sessionStorage.setItem("token_requests", JSON.stringify(updated));
                    }
                  }
                  setIsModalOpen(false);
                  router.push("/requests");
                }}
                className="bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 px-6 py-2 rounded-xl text-[14px] font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function GenerateTokensPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <GenerateTokensContent />
    </Suspense>
  );
}
