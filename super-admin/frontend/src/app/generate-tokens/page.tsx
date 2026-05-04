"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  listColleges,
  allocateTokens,
  getCollegeTokens,
  type CollegeListItem,
  type CollegeTokenOverview,
} from "@/lib/api";

// Inline SVG icons (no lucide-react dependency)
const CheckCircleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const CoinsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
);

function GenerateTokensContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCollegeId = searchParams.get("college_id") || "";

  const [colleges, setColleges] = useState<CollegeListItem[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState(initialCollegeId);
  const [count, setCount] = useState<string>(searchParams.get("count") || "100");
  const [note, setNote] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenOverview, setTokenOverview] = useState<CollegeTokenOverview | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await listColleges({ per_page: 100 });
        setColleges(res.colleges);
        if (!selectedCollegeId && res.colleges.length > 0) {
          setSelectedCollegeId(res.colleges[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load colleges.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCollegeId) return;
    const loadTokens = async () => {
      try {
        const overview = await getCollegeTokens(selectedCollegeId);
        setTokenOverview(overview);
      } catch {
        setTokenOverview(null);
      }
    };
    void loadTokens();
  }, [selectedCollegeId]);

  const selectedCollege = colleges.find((c) => c.id === selectedCollegeId);

  const handleAllocate = async () => {
    if (!selectedCollegeId) {
      setError("Please select a college.");
      return;
    }
    const parsedCount = parseInt(count, 10);
    if (!parsedCount || parsedCount <= 0) {
      setError("Please enter a valid count.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await allocateTokens(selectedCollegeId, {
        amount: parsedCount,
        note: note || undefined,
        new_expiry_date: expiryDate || undefined,
      });
      setSubmitted(true);
      // Reload token overview
      const overview = await getCollegeTokens(selectedCollegeId);
      setTokenOverview(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate tokens.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="px-8 py-6 max-w-[1200px]">
        <div className="mb-8">
          <h1 className="text-[24px] font-medium text-gray-900 mb-1">Allocate Tokens</h1>
          <p className="text-[15px] text-gray-600">
            Directly allocate tokens to a college admin&apos;s token pool.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 max-w-4xl mb-6">
          <h2 className="text-[17px] font-bold text-gray-900 mb-6">Token allocation</h2>

          <div className="flex flex-col gap-6 mb-8">
            {/* College Selector */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">College</label>
              {loading ? (
                <div className="text-sm text-gray-400">Loading colleges...</div>
              ) : (
                <select
                  value={selectedCollegeId}
                  onChange={(e) => {
                    setSelectedCollegeId(e.target.value);
                    setSubmitted(false);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 appearance-none"
                >
                  <option value="">Select a college…</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.city ? `(${c.city})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Current Token Status */}
            {tokenOverview && (
              <div className="rounded-lg bg-[#f0fdf4] p-4 border border-emerald-100 flex items-center gap-4">
                <CoinsIcon />
                <div className="flex gap-8 text-sm">
                  <div>
                    <span className="font-bold text-gray-700">{tokenOverview.total_allocated}</span>
                    <span className="text-gray-500 ml-1">Allocated</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-700">{tokenOverview.total_consumed}</span>
                    <span className="text-gray-500 ml-1">Consumed</span>
                  </div>
                  <div>
                    <span className="font-bold text-emerald-700">{tokenOverview.balance}</span>
                    <span className="text-gray-500 ml-1">Balance</span>
                  </div>
                  {tokenOverview.expiry_date && (
                    <div>
                      <span className="font-bold text-gray-700">{tokenOverview.expiry_date}</span>
                      <span className="text-gray-500 ml-1">Expires</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-6">
              {/* Count */}
              <div className="md:w-[180px]">
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">Count</label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  min="1"
                />
              </div>

              {/* Expiry Date */}
              <div className="flex-1">
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                  Expiry date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
              </div>

              {/* Note */}
              <div className="flex-[2]">
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                  Note <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Placement season Apr 2026"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleAllocate}
            disabled={submitting || !selectedCollegeId}
            className="bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl text-[16px] font-semibold tracking-wide shadow-sm transition-all focus:ring-2 focus:ring-gray-200 focus:outline-none"
          >
            {submitting ? "Allocating..." : `Allocate ${parseInt(count, 10) || 0} tokens`}
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {submitted && selectedCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <CheckCircleIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                {parseInt(count, 10)} tokens allocated
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                Successfully added to <strong>{selectedCollege.name}</strong>&apos;s token pool.
              </p>
              {tokenOverview && (
                <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm w-full text-left">
                  <div className="flex justify-between text-gray-600">
                    <span>New balance</span>
                    <span className="font-bold text-emerald-700">{tokenOverview.balance}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 mt-1">
                    <span>Total allocated</span>
                    <span className="font-bold">{tokenOverview.total_allocated}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setCount("100");
                  setNote("");
                  setExpiryDate("");
                }}
                className="flex-1 bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-[14px] font-semibold"
              >
                Allocate More
              </button>
              <button
                onClick={() => router.push("/requests")}
                className="flex-1 bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-[14px] font-semibold"
              >
                View Requests
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
