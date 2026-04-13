"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ConfirmModal from "@/components/ui/ConfirmModal";
import DataTable from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { listPendingStudents, listStudents, setStudentExpiry, toggleStudentStatus, type StudentListItem } from "@/lib/api";

const relativeTime = (dateStr: string | null) => {
  if (!dateStr) return "Never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function StudentsPage() {
  const [rows, setRows] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [sortBy, setSortBy] = useState("last_active");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [confirm, setConfirm] = useState<{ open: boolean; id: string; name: string; next: "ACTIVE" | "INACTIVE" }>({
    open: false,
    id: "",
    name: "",
    next: "INACTIVE",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsResp, pendingResp] = await Promise.all([
        listStudents({
          search: search || undefined,
          status: status || undefined,
          target_company: targetCompany || undefined,
          target_role: targetRole || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
          page,
          per_page: 20,
        }),
        listPendingStudents(),
      ]);
      setRows(studentsResp.students);
      setTotal(studentsResp.total);
      setPendingCount(pendingResp.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, search, status, targetCompany, targetRole, sortBy, sortDir]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);

  const onSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDir("asc");
  };

  const onToggle = async () => {
    await toggleStudentStatus(confirm.id, confirm.next);
    setConfirm({ open: false, id: "", name: "", next: "INACTIVE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage your student cohort and monitor readiness."
        action={
          <div className="flex gap-2">
            <Link href="/students/invite" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
              Invite Students
            </Link>
          </div>
        }
      />

      {pendingCount > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pendingCount} students pending approval. <Link href="/students/pending" className="underline">Review</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-5">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name or email"
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="PENDING">PENDING</option>
        </select>
        <input value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} placeholder="Target company" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Target role" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          <option value="name">Name</option>
          <option value="last_active">Last Active</option>
        </select>
      </div>

      {error ? <div className="rounded-lg border border-[var(--color-danger)]/40 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">{error}</div> : null}

      <DataTable
        loading={loading}
        rows={rows}
        emptyMessage="No students yet. Invite your first cohort."
        sortKey={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            render: (row) => <Link className="text-[var(--color-primary)] hover:underline" href={`/students/${row.id}`}>{row.full_name}</Link>,
          },
          { key: "email", header: "Email", render: (row) => row.email },
          { key: "company", header: "Target Company", render: (row) => row.target_company ?? "-" },
          { key: "role", header: "Target Role", render: (row) => row.target_role ?? "-" },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <button
                type="button"
                onClick={() =>
                  setConfirm({
                    open: true,
                    id: row.id,
                    name: row.full_name,
                    next: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                  })
                }
              >
                <StatusBadge status={row.status} />
              </button>
            ),
          },
          { key: "last_active", header: "Last Active", sortable: true, render: (row) => relativeTime(row.last_active_at) },
          { key: "expiry", header: "Access Expiry", render: (row) => row.access_expiry ? new Date(row.access_expiry).toLocaleDateString() : "No expiry" },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-3">
                <Link href={`/students/${row.id}`} className="text-[var(--color-primary)] hover:underline">View</Link>
                <button
                  type="button"
                  onClick={async () => {
                    const next = prompt("Set expiry date YYYY-MM-DD (empty to clear)", row.access_expiry ?? "") ?? "";
                    await setStudentExpiry(row.id, next.trim());
                    await load();
                  }}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Set Expiry
                </button>
              </div>
            ),
          },
        ]}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">Page {page} of {totalPages} ({total} students)</p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">Prev</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">Next</button>
        </div>
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.next === "INACTIVE" ? `Deactivate ${confirm.name}?` : `Reactivate ${confirm.name}?`}
        message={
          confirm.next === "INACTIVE"
            ? `This will block login for ${confirm.name}.`
            : `This will allow ${confirm.name} to access the platform again.`
        }
        confirmLabel={confirm.next === "INACTIVE" ? "Deactivate" : "Reactivate"}
        destructive={confirm.next === "INACTIVE"}
        onCancel={() => setConfirm({ open: false, id: "", name: "", next: "INACTIVE" })}
        onConfirm={() => void onToggle()}
      />
    </div>
  );
}
