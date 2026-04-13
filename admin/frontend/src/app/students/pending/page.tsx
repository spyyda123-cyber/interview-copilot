"use client";

import { useEffect, useState } from "react";

import ConfirmModal from "@/components/ui/ConfirmModal";
import DataTable from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import { approveStudent, listPendingStudents, rejectStudent, type StudentListItem } from "@/lib/api";

export default function PendingStudentsPage() {
  const [rows, setRows] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listPendingStudents();
      setRows(response.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pending students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approveAll = async () => {
    await Promise.all(rows.map((row) => approveStudent(row.id)));
    await load();
  };

  const rejectAll = async () => {
    await Promise.all(rows.map((row) => rejectStudent(row.id)));
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Approvals"
        description="Approve or reject newly pending students."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => void approveAll()} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-white">Approve All</button>
            <button type="button" onClick={() => void rejectAll()} className="rounded-lg border border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger)]">Reject All</button>
          </div>
        }
      />

      {error ? <div className="rounded-lg border border-[var(--color-danger)]/40 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">{error}</div> : null}

      <DataTable
        loading={loading}
        rows={rows}
        emptyMessage="No students pending approval"
        columns={[
          { key: "name", header: "Name", render: (row) => row.full_name },
          { key: "email", header: "Email", render: (row) => row.email },
          { key: "dept", header: "Department", render: (row) => row.department ?? "-" },
          { key: "year", header: "Graduation Year", render: (row) => row.graduation_year ?? "-" },
          { key: "created", header: "Registered On", render: (row) => new Date(row.last_active_at ?? Date.now()).toLocaleDateString() },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <button type="button" onClick={() => void approveStudent(row.id).then(load)} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Approve</button>
                <button
                  type="button"
                  onClick={() => setConfirmReject({ open: true, id: row.id, name: row.full_name })}
                  className="rounded border border-[var(--color-danger)] px-3 py-1 text-xs text-[var(--color-danger)]"
                >
                  Reject
                </button>
              </div>
            ),
          },
        ]}
      />

      <ConfirmModal
        open={confirmReject.open}
        title={`Reject ${confirmReject.name}?`}
        message="This action will remove the pending student entry."
        confirmLabel="Reject"
        destructive
        onCancel={() => setConfirmReject({ open: false, id: "", name: "" })}
        onConfirm={() => void rejectStudent(confirmReject.id).then(load).finally(() => setConfirmReject({ open: false, id: "", name: "" }))}
      />
    </div>
  );
}
