"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, Search, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import {
  listApplications,
  listCompanies,
  approveApplication,
  rejectApplication,
  type ApplicationItem,
  type CompanyResponse,
} from "@/lib/api";

function ValidationBadge({
  label,
  value,
  pass,
}: {
  label: string;
  value: string | number;
  pass: boolean | null | undefined;
}) {
  const isNeutral = pass === null || pass === undefined;
  return (
    <div
      className={`flex flex-col rounded border px-2 py-1 text-xs ${
        isNeutral
          ? "border-gray-200 bg-gray-50 text-gray-600"
          : pass
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <span className="mb-0.5 text-[9px] uppercase font-semibold text-gray-500">{label}</span>
      <span
        className={`font-medium text-sm leading-none ${
          isNeutral ? "text-gray-700" : pass ? "text-emerald-700" : "text-red-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function ApprovalsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("INTERESTED");
  const [search, setSearch] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, compsRes] = await Promise.all([
        listApplications({
          company_id: selectedCompanyId || undefined,
          status: statusFilter || undefined,
          per_page: 100,
        }),
        listCompanies(1, 100),
      ]);
      setApplications(appsRes.applications);
      setCompanies(compsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async (app: ApplicationItem) => {
    setActionLoading((p) => ({ ...p, [app.application_id]: true }));
    try {
      await approveApplication(app.application_id);
      setActionMessages((p) => ({ ...p, [app.application_id]: "Approved ✓" }));
      void loadData();
    } catch (err) {
      setActionMessages((p) => ({
        ...p,
        [app.application_id]: err instanceof Error ? err.message : "Failed",
      }));
    } finally {
      setActionLoading((p) => ({ ...p, [app.application_id]: false }));
    }
  };

  const handleReject = async (app: ApplicationItem) => {
    setActionLoading((p) => ({ ...p, [app.application_id]: true }));
    try {
      await rejectApplication(app.application_id);
      setActionMessages((p) => ({ ...p, [app.application_id]: "Rejected" }));
      void loadData();
    } catch (err) {
      setActionMessages((p) => ({
        ...p,
        [app.application_id]: err instanceof Error ? err.message : "Failed",
      }));
    } finally {
      setActionLoading((p) => ({ ...p, [app.application_id]: false }));
    }
  };

  // Filter by search
  const filtered = applications.filter((app) => {
    const q = search.toLowerCase();
    return (
      !q ||
      app.student_name.toLowerCase().includes(q) ||
      app.student_email.toLowerCase().includes(q) ||
      app.company_name.toLowerCase().includes(q) ||
      (app.roll_no || "").toLowerCase().includes(q)
    );
  });

  // Stats
  const totalInterested = applications.filter((a) => a.application_status === "INTERESTED").length;
  const totalApproved = applications.filter((a) => a.application_status === "APPROVED").length;
  const totalRejected = applications.filter((a) => a.application_status === "REJECTED").length;
  const totalActivated = applications.filter((a) => a.application_status === "ACTIVATED").length;

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="flex flex-col h-full bg-white space-y-6">
      <div className="max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Student approvals</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review student placement applications. CGPA and backlogs are verified against your student database.
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Interested</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-amber-600">
              {loading ? "..." : totalInterested}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Approved</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-emerald-600">
              {loading ? "..." : totalApproved}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Rejected</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-red-600">
              {loading ? "..." : totalRejected}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Activated</div>
            <div className="mt-1 flex items-baseline text-3xl font-semibold text-blue-600">
              {loading ? "..." : totalActivated}
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Company Filter */}
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} — {c.role}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-500" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="INTERESTED">Interested (Pending)</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ACTIVATED">Activated</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-500" />
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, roll no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            />
          </div>
        </div>

        {/* Selected Company Criteria Banner */}
        {selectedCompany && (
          <div className="mt-4 flex items-center rounded-md bg-[#e0f2fe] px-3 py-2 text-sm font-medium text-[#0369a1]">
            {selectedCompany.company_name} — {selectedCompany.role}
            {selectedCompany.min_cgpa && ` · Min CGPA: ${selectedCompany.min_cgpa}`}
            {selectedCompany.max_backlogs !== null && selectedCompany.max_backlogs !== undefined && ` · Max backlogs: ${selectedCompany.max_backlogs}`}
            {selectedCompany.eligible_departments?.length > 0 && ` · Depts: ${selectedCompany.eligible_departments.join(", ")}`}
          </div>
        )}

        {/* Student List */}
        {loading ? (
          <div className="mt-8 text-center text-sm text-gray-400 py-12">Loading applications...</div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
            No applications found.{" "}
            {statusFilter === "INTERESTED" && "Students who click 'Interested' on companies will appear here."}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {filtered.map((app) => (
              <div
                key={app.application_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-xs font-bold text-gray-600 uppercase border border-gray-200">
                    {app.student_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>

                  {/* Info Block */}
                  <div className="min-w-[200px]">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-semibold text-gray-900">{app.student_name}</h3>
                      {app.roll_no && (
                        <span className="text-xs font-medium text-gray-500">{app.roll_no}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      {app.department && `${app.department} · `}
                      {app.student_email}
                    </div>
                    <div className="mt-1 text-xs font-medium text-indigo-600">
                      {app.company_name} — {app.role}
                    </div>
                  </div>

                  {/* Validation Tags */}
                  <div className="ml-4 hidden md:flex items-center gap-2">
                    {app.cgpa !== null && app.cgpa !== undefined ? (
                      <ValidationBadge
                        label="CGPA"
                        value={app.cgpa.toFixed(1)}
                        pass={app.meets_cgpa}
                      />
                    ) : (
                      <ValidationBadge label="CGPA" value="N/A" pass={null} />
                    )}
                    {app.backlogs !== null && app.backlogs !== undefined ? (
                      <ValidationBadge
                        label="BACKLOGS"
                        value={app.backlogs}
                        pass={app.meets_backlogs}
                      />
                    ) : (
                      <ValidationBadge label="BACKLOGS" value="N/A" pass={null} />
                    )}
                    {app.department && (
                      <ValidationBadge
                        label="DEPT"
                        value={app.department}
                        pass={app.meets_dept}
                      />
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex shrink-0 items-center gap-2 sm:mt-0 ml-auto">
                  {actionMessages[app.application_id] ? (
                    <span className={`text-sm font-medium px-3 py-1 rounded-md ${
                      actionMessages[app.application_id].includes("Approved")
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-red-600 bg-red-50"
                    }`}>
                      {actionMessages[app.application_id]}
                    </span>
                  ) : app.application_status === "INTERESTED" ? (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading[app.application_id]}
                        onClick={() => void handleApprove(app)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-2 font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading[app.application_id]}
                        onClick={() => void handleReject(app)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-5 py-2 font-medium text-gray-700 shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </>
                  ) : (
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-[12px] font-bold ${
                        app.application_status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : app.application_status === "ACTIVATED"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {app.application_status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 rounded-lg bg-gray-50 border border-gray-100 p-4 text-xs text-gray-600 shadow-inner">
          <p>
            <strong className="font-semibold text-gray-800">Data source:</strong> CGPA and backlogs are
            from your student database (Excel upload). On approve: student can activate the company in
            their placement page. Activation triggers study plan generation.
          </p>
          <p className="mt-1">
            <strong className="font-semibold text-gray-800">Status flow:</strong> Student marks
            Interested → Admin Approves/Rejects → Student Activates → Study plan generated.
          </p>
        </div>
      </div>
    </div>
  );
}
