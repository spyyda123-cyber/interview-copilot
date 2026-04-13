"use client";

import { ChevronRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full bg-white sm:bg-transparent">
      {/* Container */}
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-gray-900 tracking-tight font-serif">Dashboard</h1>
          <p className="mt-1 text-[13px] text-gray-500 font-medium">Placement Season — April 2026</p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
            <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Total Students</div>
            <div>
              <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">8</div>
              <div className="text-[11px] text-gray-500 font-medium">Registered this season</div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
            <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Eligible</div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">6</div>
                <div className="text-[11px] text-gray-500 font-medium">75% of total</div>
              </div>
              <div className="rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 mb-0.5">
                ↑ 12%
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
            <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Active Companies</div>
            <div>
              <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">3</div>
              <div className="text-[11px] text-gray-500 font-medium">5 total companies</div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-between h-[120px]">
            <div className="text-[10px] font-bold tracking-[0.1em] text-gray-500 uppercase">Pending Approvals</div>
            <div>
              <div className="text-3xl font-bold text-[#d97706] leading-none mb-1.5">3</div>
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
              <button type="button" className="rounded-lg px-2 py-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-white transition-colors flex items-center gap-0.5 border border-transparent hover:border-gray-200 shadow-sm hover:shadow">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { init: "AK", name: "Arun Kumar", role: "TCS · Java Backend Developer", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
                { init: "PS", name: "Priya Sharma", role: "Infosys · Systems Engineer", color: "bg-purple-100 text-purple-700 border-purple-200" },
                { init: "SR", name: "Sneha Reddy", role: "Freshworks · SDE Intern", color: "bg-blue-100 text-blue-700 border-blue-200" },
              ].map((app, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg border ${app.color} text-sm font-bold shadow-inner`}>
                      {app.init}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{app.name}</div>
                      <div className="mt-0.5 text-[12px] font-medium text-gray-500">{app.role}</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-600">
                    Pending
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Companies Pane */}
          <div className="flex flex-col lg:pl-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Active Companies</h2>
              <button type="button" className="rounded-lg px-2 py-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-white transition-colors flex items-center gap-0.5 border border-transparent hover:border-gray-200 shadow-sm hover:shadow">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

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
                  {[
                    { company: "TCS", role: "Java Backend Developer", ctc: "4.5 LPA", applied: "4/6" },
                    { company: "Infosys", role: "Systems Engineer", ctc: "3.8 LPA", applied: "3/5" },
                    { company: "Freshworks", role: "SDE Intern", ctc: "8.0 LPA", applied: "2/3" },
                  ].map((comp, idx) => (
                    <tr key={idx} className="group hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-5 py-4 font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{comp.company}</td>
                      <td className="px-5 py-4 text-[13px] text-gray-600 font-medium">{comp.role}</td>
                      <td className="px-5 py-4 text-[13px] text-gray-600 font-medium whitespace-nowrap">{comp.ctc}</td>
                      <td className="px-5 py-4 text-[13px] text-gray-500 font-medium">{comp.applied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
