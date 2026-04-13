"use client";

import { ChevronDown, Search } from "lucide-react";

type StudentData = {
  id: string;
  name: string;
  rollNo: string;
  dept: string;
  email: string;
  totalTokens: number;
  usedTokens: number;
  cgpa: number;
  backlogs: number;
  meetsCgpa: boolean;
  meetsBacklogs: boolean;
  meetsDept: boolean;
};

const MOCK_STUDENTS: StudentData[] = [
  {
    id: "1",
    name: "Arun Kumar",
    rollNo: "21CS101",
    dept: "CSE",
    email: "arun@kgcollege.edu",
    totalTokens: 3,
    usedTokens: 1,
    cgpa: 8.2,
    backlogs: 0,
    meetsCgpa: true,
    meetsBacklogs: true,
    meetsDept: true,
  },
  {
    id: "2",
    name: "Priya Sharma",
    rollNo: "21IT042",
    dept: "IT",
    email: "priya@kgcollege.edu",
    totalTokens: 1,
    usedTokens: 0,
    cgpa: 7.8,
    backlogs: 0,
    meetsCgpa: true,
    meetsBacklogs: true,
    meetsDept: true,
  },
  {
    id: "3",
    name: "Deepak R",
    rollNo: "21CS089",
    dept: "CSE",
    email: "deepak@kgcollege.edu",
    totalTokens: 0,
    usedTokens: 0,
    cgpa: 5.9,
    backlogs: 2,
    meetsCgpa: false,
    meetsBacklogs: false,
    meetsDept: true,
  },
];

function ValidationBadge({ 
  label, 
  value, 
  pass 
}: { 
  label: string; 
  value: string | number; 
  pass: boolean;
}) {
  return (
    <div className={`flex flex-col rounded border px-2 py-1 text-xs ${pass ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
      <span className="mb-0.5 text-[9px] uppercase font-semibold text-gray-500">{label}</span>
      <span className={`font-medium text-sm leading-none ${pass ? "text-emerald-700" : "text-red-700"}`}>{value}</span>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <div className="flex flex-col h-full bg-white space-y-6">
      <div className="max-w-5xl">
        <h2 className="text-2xl font-bold text-gray-900">Student approvals</h2>
        <p className="mt-1 text-sm text-gray-600">CGPA and backlogs pulled from your student database (Excel upload).</p>

        {/* Stats Row */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Total Approved</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-emerald-600">
              26
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Total Rejected</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-red-600">
              5
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Pending Review</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-amber-600">
              12
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Tokens Remaining</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-gray-900">
              91
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option>All companies</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-500" />
          </div>

          <div className="relative">
            <select className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option>All roles</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-500" />
          </div>

          <div className="relative">
            <select className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option>Pending</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-500" />
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            />
          </div>
        </div>

        {/* Selected Criteria Banner */}
        <div className="mt-4 flex items-center rounded-md bg-[#e0f2fe] px-3 py-2 text-sm font-medium text-[#0369a1]">
          TCS — Java Backend Dev · Min CGPA: 6.5 · Max backlogs: 0 · Depts: CSE, IT
        </div>

        {/* Student List */}
        <div className="mt-4 flex flex-col gap-3">
          {MOCK_STUDENTS.map((student) => (
            <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm relative">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-xs font-bold text-gray-600 uppercase border border-gray-200">
                  {student.name.split(" ").map((n) => n[0]).join("")}
                </div>
                
                {/* Info Block */}
                <div className="min-w-[200px]">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-semibold text-gray-900">{student.name}</h3>
                    <span className="text-xs font-medium text-gray-500">{student.rollNo}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {student.dept} - {student.email}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">Total tokens: {student.totalTokens}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">Used: {student.usedTokens}</span>
                  </div>
                </div>

                {/* Validation Tags */}
                <div className="ml-4 hidden md:flex items-center gap-2">
                  <ValidationBadge label="CGPA (FROM DB)" value={student.cgpa.toFixed(1)} pass={student.meetsCgpa} />
                  <ValidationBadge label="BACKLOGS (FROM DB)" value={student.backlogs} pass={student.meetsBacklogs} />
                  <div className="flex flex-col rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs">
                    <span className="mb-0.5 text-[9px] uppercase font-semibold text-gray-500">DEPT</span>
                    <span className="font-medium text-sm leading-none text-emerald-700">{student.dept}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex shrink-0 items-center gap-2 sm:mt-0 ml-auto">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-medium text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-medium text-gray-900 shadow-sm hover:bg-gray-50 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-6 rounded-lg bg-gray-50 border border-gray-100 p-4 text-xs text-gray-600 shadow-inner">
          <p>
            <strong className="font-semibold text-gray-800">Data source:</strong> CGPA and backlogs are from admin's student database (Excel upload) — NOT from student input. On approve: 1 token is reserved from pool at backend. When student clicks "Activate" on this company, token is consumed. Student never sees token value.
          </p>
          <p className="mt-1">
            <strong className="font-semibold text-gray-800">Role filter:</strong> Use the role dropdown to filter when a company has multiple roles (e.g., TCS — Java Backend Dev vs TCS — Data Analyst).
          </p>
        </div>
      </div>
    </div>
  );
}
