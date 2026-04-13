"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

const INITIAL_REQUESTS = [
  { id: 1, college: "KG College", admin: "Naveen", count: 100, date: "Mar 28, 2026", note: "Placement season Apr 2026", status: "Pending" },
  { id: 2, college: "SRM Trichy", admin: "Priya", count: 200, date: "Mar 27, 2026", note: "Campus drive recruitment", status: "Pending" },
  { id: 3, college: "VIT Chennai", admin: "Rajan", count: 50, date: "Mar 25, 2026", note: "Mock interview sessions", status: "Pending" },
  { id: 4, college: "PSG Tech", admin: "Meena", count: 75, date: "Mar 20, 2026", note: "—", status: "Assigned" },
  { id: 5, college: "Anna Univ", admin: "Karthik", count: 120, date: "Mar 18, 2026", note: "Semester prep access", status: "Assigned" },
  { id: 6, college: "Sastra Univ", admin: "Divya", count: 30, date: "Mar 15, 2026", note: "—", status: "Pending" },
];

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<typeof INITIAL_REQUESTS>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [collegeFilter, setCollegeFilter] = useState("All colleges");

  useEffect(() => {
    // Load from sessionStorage or use initial
    const stored = sessionStorage.getItem("token_requests");
    if (stored) {
      setRequests(JSON.parse(stored));
    } else {
      setRequests(INITIAL_REQUESTS);
      sessionStorage.setItem("token_requests", JSON.stringify(INITIAL_REQUESTS));
    }
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch =
        r.college.toLowerCase().includes(search.toLowerCase()) ||
        r.admin.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All status" || r.status === statusFilter;
      const matchCollege = collegeFilter === "All colleges" || r.college === collegeFilter;
      return matchSearch && matchStatus && matchCollege;
    });
  }, [requests, search, statusFilter, collegeFilter]);

  const handleGenerate = (id: number, college: string, count: number) => {
    // Navigate to generate tokens page with pre-filled data and ID
    const params = new URLSearchParams();
    params.set("id", id.toString());
    params.set("college", college);
    params.set("count", count.toString());
    router.push(`/generate-tokens?${params.toString()}`);
  };

  const getStatusStyle = (status: string) => {
    if (status === "Pending") return "bg-[#fefce8] text-[#85410e] border border-[#fef9c3]";
    if (status === "Assigned") return "bg-[#ecfdf5] text-[#047857] border border-[#d1fae5]";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#111827]">Token requests</h1>
        <p className="text-lg text-[#6b7280] mt-1">Review and approve token requests from college admins.</p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select 
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 bg-white text-lg appearance-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All status</option>
            <option>Pending</option>
            <option>Assigned</option>
          </select>
          <select 
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 bg-white text-lg appearance-none cursor-pointer"
            value={collegeFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
          >
            <option>All colleges</option>
            {[...new Set(INITIAL_REQUESTS.map(r => r.college))].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search by college or admin..." 
            className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/10 text-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <p className="text-sm text-[#6b7280]">Showing {filteredRequests.length} of {INITIAL_REQUESTS.length} requests</p>
      </div>

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
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-6 text-[15px] font-bold text-[#111827]">{req.college}</td>
                  <td className="px-6 py-6 text-[15px] font-medium text-[#4b5563]">{req.admin}</td>
                  <td className="px-5 py-6">
                    <span className="px-3 py-1 rounded-full bg-[#eff6ff] text-[#1e40af] text-[13px] font-bold">{req.count}</span>
                  </td>
                  <td className="px-6 py-6 text-[14px] text-[#6b7280] leading-tight">
                    {req.date.split(", ").map((part, i) => (
                      <div key={i}>{part}</div>
                    ))}
                  </td>
                  <td className="px-6 py-6 text-[14px] text-[#6b7280] max-w-[120px] truncate">{req.note}</td>
                  <td className="px-6 py-6 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-[13px] font-bold ${getStatusStyle(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right">
                    {req.status === "Pending" ? (
                      <button 
                        onClick={() => handleGenerate(req.id, req.college, req.count)}
                        className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-[#111827] text-[14px] font-bold hover:bg-gray-50 transition-all shadow-sm"
                      >
                        Generate
                      </button>
                    ) : (
                      <button className="px-6 py-2.5 rounded-xl border border-gray-300 bg-white text-[#111827] text-[14px] font-bold hover:bg-gray-50 transition-all shadow-sm">
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6b7280]">No matching requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-[#f9fafb] border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-[#6b7280]">1-{filteredRequests.length} of {filteredRequests.length} requests</p>
          <div className="flex gap-2">
            <button className="px-6 py-3 rounded-xl border border-gray-300 bg-gray-50 text-[#6b7280] text-[14px] font-bold cursor-not-allowed">Prev</button>
            <button className="w-12 h-12 rounded-xl border border-gray-300 bg-white text-[#111827] text-[14px] font-bold flex items-center justify-center">1</button>
            <button className="px-6 py-3 rounded-xl border border-gray-300 bg-gray-50 text-[#6b7280] text-[14px] font-bold cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
